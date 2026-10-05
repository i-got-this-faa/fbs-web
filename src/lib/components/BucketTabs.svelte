<script lang="ts">
	import { resolve } from '$app/paths';
	const tabs = [
		{ value: 'objects', label: 'Objects' },
		{ value: 'permissions', label: 'Permissions' },
		{ value: 'share-links', label: 'Share links' }
	] as const;
	const {
		activeTab,
		bucketName
	}: { activeTab: (typeof tabs)[number]['value']; bucketName: string } = $props();
</script>

<nav
	aria-label="Bucket views"
	class="flex shrink-0 gap-1 self-start rounded-lg border border-surface-800 bg-surface-950 p-1"
>
	{#each tabs as tab (tab.value)}
		<a
			href={`${resolve('/app/buckets/[bucket]', { bucket: bucketName })}?tab=${tab.value}`}
			data-sveltekit-noscroll
			data-sveltekit-replacestate
			aria-current={activeTab === tab.value ? 'page' : undefined}
			class="rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors {activeTab ===
			tab.value
				? 'bg-surface-800 text-accent-400'
				: 'text-surface-400 hover:text-surface-200'}">{tab.label}</a
		>
	{/each}
</nav>
