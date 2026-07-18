<script lang="ts">
	import { untrack } from 'svelte';

	interface AutocompleteItem {
		id: string;
		label: string;
		group?: string;
		disabled?: boolean;
	}

	interface Props {
		id?: string;
		value: string;
		placeholder?: string;
		items: AutocompleteItem[];
		disabled?: boolean;
		allowCustom?: boolean;
	}

	let {
		id = '',
		value = $bindable(),
		placeholder = 'Search...',
		items = [],
		disabled = false,
		allowCustom = false
	}: Props = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
	let activeIndex = $state(-1);
	let containerEl = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	// Synchronize external value changes to the search query text
	$effect(() => {
		const selected = items.find((item) => item.id === value);
		if (selected) {
			untrack(() => {
				searchQuery = selected.label;
			});
		} else if (!value) {
			untrack(() => {
				searchQuery = '';
			});
		} else if (allowCustom) {
			untrack(() => {
				searchQuery = value;
			});
		}
	});

	// Filter items based on user search query
	const filteredItems = $derived.by(() => {
		const query = searchQuery.toLowerCase().trim();
		if (!query) return items;
		return items.filter(
			(item) =>
				item.label.toLowerCase().includes(query) ||
				(item.group && item.group.toLowerCase().includes(query))
		);
	});

	// Group filtered items and assign a flat index to each for keyboard navigation
	const groupedFilteredItems = $derived.by(() => {
		const groups: Array<{
			name: string | undefined;
			items: Array<AutocompleteItem & { flatIndex: number }>;
		}> = [];
		let flatIndex = 0;
		for (const item of filteredItems) {
			let group = groups.find((g) => g.name === item.group);
			if (!group) {
				group = { name: item.group, items: [] };
				groups.push(group);
			}
			group.items.push({ ...item, flatIndex: flatIndex++ });
		}
		return groups;
	});

	// Reset keyboard navigation index when filtered list changes
	$effect(() => {
		if (filteredItems) {
			untrack(() => {
				activeIndex = -1;
			});
		}
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (disabled) return;

		if (!isOpen) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				isOpen = true;
				event.preventDefault();
			}
			// Enter when closed: let the surrounding form submit normally
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (filteredItems.length === 0) return;
			// Find next non-disabled item
			let nextIndex = activeIndex;
			for (let i = 0; i < filteredItems.length; i++) {
				nextIndex = (nextIndex + 1) % filteredItems.length;
				if (!filteredItems[nextIndex]?.disabled) {
					activeIndex = nextIndex;
					break;
				}
			}
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (filteredItems.length === 0) return;
			// Find previous non-disabled item
			let prevIndex = activeIndex;
			for (let i = 0; i < filteredItems.length; i++) {
				prevIndex = (prevIndex - 1 + filteredItems.length) % filteredItems.length;
				if (!filteredItems[prevIndex]?.disabled) {
					activeIndex = prevIndex;
					break;
				}
			}
		} else if (event.key === 'Enter') {
			if (activeIndex >= 0 && activeIndex < filteredItems.length) {
				const item = filteredItems[activeIndex];
				if (item && !item.disabled) {
					event.preventDefault();
					selectItem(item);
				}
			} else if (filteredItems.length > 0) {
				// Unambiguous single match — select it
				const item = filteredItems.find((i) => !i.disabled);
				if (item) {
					event.preventDefault();
					selectItem(item);
				}
			} else {
				// No items to select: close dropdown and let the form submit
				isOpen = false;
			}
		} else if (event.key === 'Escape') {
			isOpen = false;
			if (!allowCustom) {
				// Revert to selected label
				const selected = items.find((item) => item.id === value);
				searchQuery = selected ? selected.label : '';
			}
		}
	}

	function selectItem(item: AutocompleteItem) {
		value = item.id;
		searchQuery = item.label;
		isOpen = false;
		activeIndex = -1;
	}
</script>

<svelte:window
	onclick={(e) => {
		if (isOpen && containerEl && !containerEl.contains(e.target as Node)) {
			isOpen = false;
			if (!allowCustom) {
				// Revert searchQuery to selected label if no selection was made
				const selected = items.find((item) => item.id === value);
				searchQuery = selected ? selected.label : '';
			}
		}
	}}
/>

<div bind:this={containerEl} class="relative w-full">
	<div class="relative flex items-center">
		<input
			{id}
			bind:this={inputEl}
			type="text"
			{disabled}
			{placeholder}
			value={searchQuery}
			oninput={(e) => {
				searchQuery = e.currentTarget.value;
				isOpen = true;
				if (allowCustom) {
					value = searchQuery;
				} else if (!searchQuery) {
					value = '';
				}
			}}
			onfocus={() => {
				isOpen = true;
			}}
			onkeydown={handleKeyDown}
			onblur={(e) => {
				// Close when focus leaves the component entirely (Tab navigation)
				if (!containerEl?.contains(e.relatedTarget as Node)) {
					isOpen = false;
					if (!allowCustom) {
						const selected = items.find((item) => item.id === value);
						searchQuery = selected ? selected.label : '';
					}
				}
			}}
			class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pr-10 pl-3 text-xs text-surface-100 placeholder-surface-500 outline-none focus:border-accent-500 disabled:opacity-50"
		/>

		<!-- Clear & Dropdown indicators -->
		<div class="text-surface-450 absolute right-2.5 flex items-center gap-1.5">
			{#if searchQuery}
				<button
					type="button"
					tabindex="-1"
					aria-label="Clear search"
					class="rounded p-0.5 hover:bg-surface-700 hover:text-surface-200"
					onclick={() => {
						searchQuery = '';
						value = '';
						inputEl?.focus();
					}}
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			{/if}
			<button
				type="button"
				tabindex="-1"
				{disabled}
				aria-label="Toggle options list"
				class="rounded p-0.5 hover:bg-surface-700 hover:text-surface-200"
				onclick={() => {
					isOpen = !isOpen;
					if (isOpen) {
						inputEl?.focus();
					}
				}}
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
		</div>
	</div>

	{#if isOpen && !disabled}
		<div
			class="absolute right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-surface-700 bg-surface-800 py-1 shadow-xl shadow-black/40"
		>
			{#if groupedFilteredItems.length === 0}
				<div class="px-3 py-2.5 text-center text-xs text-surface-500 italic select-none">
					No matching options
				</div>
			{:else}
				{#each groupedFilteredItems as group (group.name ?? 'default')}
					{#if group.name}
						<div
							class="bg-surface-850/50 px-3 py-1.5 text-[9px] font-bold tracking-wider text-surface-500 uppercase select-none"
						>
							{group.name}
						</div>
					{/if}
					{#each group.items as item (item.id)}
						<button
							type="button"
							disabled={item.disabled}
							onclick={() => selectItem(item)}
							class="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs text-surface-200 transition-colors disabled:cursor-not-allowed disabled:opacity-40 {value ===
							item.id
								? 'bg-accent-500/10 font-semibold text-accent-400'
								: ''} {activeIndex === item.flatIndex
								? 'bg-surface-700/80 text-surface-100'
								: 'hover:bg-surface-700/40'}"
						>
							<span>{item.label}</span>
							{#if value === item.id}
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-accent-400"
								>
									<path d="M20 6 9 17l-5-5" />
								</svg>
							{/if}
						</button>
					{/each}
				{/each}
			{/if}
		</div>
	{/if}
</div>
