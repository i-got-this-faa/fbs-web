<script lang="ts">
	import { page } from '$app/state';
	import { getConnectionContext } from '$lib/stores/connection.svelte';

	interface NavItem {
		label: string;
		href: string;
		icon: string;
	}

	const { collapsed = false, onnavigate }: { collapsed?: boolean; onnavigate?: () => void } =
		$props();

	const connection = getConnectionContext();

	const navItems: NavItem[] = [
		{ label: 'Dashboard', href: '/app', icon: 'dashboard' },
		{ label: 'Buckets', href: '/app/buckets', icon: 'bucket' },
		{ label: 'Access Keys', href: '/app/keys', icon: 'key' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/app') return path === '/app';
		return path.startsWith(href);
	}

	const isSettingsActive = $derived(page.url.pathname.startsWith('/app/settings'));
</script>

<aside
	class="flex h-full flex-col border-r border-surface-800 bg-surface-900 transition-all duration-200 {collapsed
		? 'w-16'
		: 'w-56'}"
>
	<!-- Logo -->
	<div class="flex h-14 items-center border-b border-surface-800 px-4">
		<a href="/app" class="flex items-center gap-2.5" onclick={() => onnavigate?.()}>
			<div
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/15 text-accent-400"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
					/>
					<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
					<line x1="12" y1="22.08" x2="12" y2="12" />
				</svg>
			</div>
			{#if !collapsed}
				<span class="text-sm font-semibold tracking-tight text-surface-100">FBS</span>
			{/if}
		</a>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 space-y-1 px-2 py-3">
		{#each navItems as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				onclick={() => onnavigate?.()}
				class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
					{active
					? 'bg-accent-500/10 text-accent-400'
					: 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'}"
				aria-current={active ? 'page' : undefined}
			>
				<span class="flex h-5 w-5 shrink-0 items-center justify-center">
					{#if item.icon === 'dashboard'}
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect x="3" y="3" width="7" height="7" rx="1" />
							<rect x="14" y="3" width="7" height="7" rx="1" />
							<rect x="3" y="14" width="7" height="7" rx="1" />
							<rect x="14" y="14" width="7" height="7" rx="1" />
						</svg>
					{:else if item.icon === 'bucket'}
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<ellipse cx="12" cy="5" rx="9" ry="3" />
							<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
							<path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
						</svg>
					{:else if item.icon === 'key'}
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path
								d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
							/>
						</svg>
					{/if}
				</span>
				{#if !collapsed}
					<span>{item.label}</span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Footer: Settings + Connection Status -->
	<div class="border-t border-surface-800 px-2 py-2">
		<!-- Settings link -->
		<a
			href="/app/settings"
			onclick={() => onnavigate?.()}
			class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
				{isSettingsActive
				? 'bg-accent-500/10 text-accent-400'
				: 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'}"
		>
			<span class="flex h-5 w-5 shrink-0 items-center justify-center">
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
					/>
					<circle cx="12" cy="12" r="3" />
				</svg>
			</span>
			{#if !collapsed}
				<span>Settings</span>
			{/if}
		</a>

		<!-- Connection indicator -->
		{#if !collapsed}
			<div class="mt-1 flex items-center gap-2 px-3 py-1.5 text-xs text-surface-500">
				<span
					class="inline-block h-1.5 w-1.5 rounded-full {connection.useMock
						? 'bg-warning-500'
						: connection.isConnected
							? 'bg-accent-500'
							: 'bg-danger-500'}"
				></span>
				<span>
					{connection.useMock
						? 'Mock Mode'
						: connection.isConnected
							? connection.apiUrl
							: 'Disconnected'}
				</span>
			</div>
		{:else}
			<div class="mt-1 flex justify-center py-1.5">
				<span
					class="inline-block h-2 w-2 rounded-full {connection.useMock
						? 'bg-warning-500'
						: connection.isConnected
							? 'bg-accent-500'
							: 'bg-danger-500'}"
				></span>
			</div>
		{/if}
	</div>
</aside>
