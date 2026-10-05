<script lang="ts">
	import { page } from '$app/state';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';

	const { onmenutoggle }: { onmenutoggle?: () => void } = $props();
	const pageActions = getPageActionsContext();

	/** Map route segments to human-readable labels */
	const labelMap: Record<string, string> = {
		app: 'Home',
		buckets: 'Buckets',
		keys: 'Access Keys',
		settings: 'Settings'
	};

	/** Build breadcrumb from current URL path, skipping the bare "app" prefix */
	const breadcrumbs = $derived.by(() => {
		const path = page.url.pathname;
		const segments = path.split('/').filter(Boolean);
		const crumbs: Array<{ label: string; href: string }> = [];

		let accumulated = '';
		for (const seg of segments) {
			accumulated += '/' + seg;
			// Skip /app itself — it's just the layout prefix
			if (accumulated === '/app') continue;
			crumbs.push({
				label: labelMap[seg] ?? decodeURIComponent(seg),
				href: accumulated
			});
		}

		return crumbs;
	});

	const pageTitle = $derived(
		breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : 'Dashboard'
	);
</script>

<header
	class="flex h-14 shrink-0 items-center justify-between border-b border-surface-800 bg-surface-900/50 px-4 backdrop-blur-sm md:px-6"
>
	<div class="flex min-w-0 items-center gap-3">
		<!-- Mobile menu button -->
		<button
			class="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200 md:hidden"
			onclick={() => onmenutoggle?.()}
			aria-label="Toggle sidebar"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="4" y1="6" x2="20" y2="6" />
				<line x1="4" y1="12" x2="20" y2="12" />
				<line x1="4" y1="18" x2="20" y2="18" />
			</svg>
		</button>

		<!-- Page title + breadcrumbs -->
		{#if breadcrumbs.length > 1}
			<nav
				class="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm"
				aria-label="Breadcrumb"
			>
				{#each breadcrumbs as crumb, i (crumb.href)}
					{#if i > 0}
						<span class="hidden text-surface-600 sm:inline">/</span>
					{/if}
					{#if i === breadcrumbs.length - 1}
						<div class="flex min-w-0 items-center gap-2">
							<span class="truncate font-medium text-surface-200">{crumb.label}</span>
						</div>
					{:else}
						<a
							href={crumb.href}
							class="hidden shrink-0 text-surface-500 transition-colors hover:text-surface-300 sm:inline"
						>
							{crumb.label}
						</a>
					{/if}
				{/each}
			</nav>
		{:else}
			<h2 class="text-sm font-medium text-surface-200">{pageTitle}</h2>
		{/if}
	</div>

	<!-- Page-specific actions -->
	{#if pageActions.actions}
		<div class="flex shrink-0 items-center gap-2">
			{@render pageActions.actions()}
		</div>
	{/if}
</header>
