<script lang="ts">
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import { page } from '$app/state';

	const { onmenutoggle }: { onmenutoggle?: () => void } = $props();

	const connection = getConnectionContext();

	/** Build breadcrumb from current URL path */
	const breadcrumbs = $derived.by(() => {
		const path = page.url.pathname;
		const segments = path.split('/').filter(Boolean);
		const crumbs: Array<{ label: string; href: string }> = [];

		let accumulated = '';
		for (const seg of segments) {
			accumulated += '/' + seg;
			crumbs.push({
				label: seg.charAt(0).toUpperCase() + seg.slice(1),
				href: accumulated
			});
		}

		return crumbs;
	});
</script>

<header
	class="flex h-14 shrink-0 items-center justify-between border-b border-surface-800 bg-surface-900/50 px-4 backdrop-blur-sm md:px-6"
>
	<div class="flex items-center gap-3">
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

		<!-- Breadcrumbs -->
		<nav class="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
			{#each breadcrumbs as crumb, i (crumb.href)}
				{#if i > 0}
					<span class="text-surface-600">/</span>
				{/if}
				{#if i === breadcrumbs.length - 1}
					<span class="font-medium text-surface-200">{crumb.label}</span>
				{:else}
					<a href={crumb.href} class="text-surface-400 transition-colors hover:text-surface-200">
						{crumb.label}
					</a>
				{/if}
			{/each}
		</nav>
	</div>

	<!-- Right side -->
	<div class="flex items-center gap-3">
		<!-- Connection status -->
		<div
			class="hidden items-center gap-2 rounded-full px-3 py-1 text-xs font-medium sm:flex
				{connection.useMock
				? 'bg-warning-500/10 text-warning-400'
				: connection.isConnected
					? 'bg-accent-500/10 text-accent-400'
					: 'bg-danger-500/10 text-danger-400'}"
		>
			<span
				class="inline-block h-1.5 w-1.5 rounded-full
					{connection.useMock
					? 'bg-warning-500'
					: connection.isConnected
						? 'bg-accent-500'
						: 'bg-danger-500'}"
			></span>
			{connection.useMock ? 'Mock Mode' : connection.isConnected ? 'Connected' : 'Disconnected'}
		</div>

		<!-- Settings link -->
		{#if connection.isConnected}
			<a
				href="/app/settings"
				class="rounded-lg p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-300"
				title="Settings"
			>
				<svg
					width="16"
					height="16"
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
			</a>
		{/if}
	</div>
</header>
