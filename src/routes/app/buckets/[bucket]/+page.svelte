<script lang="ts">
	import { page } from '$app/state';
	import { getObjectsContext } from '$lib/stores/objects.svelte';
	import { formatBytes, timeAgo, keyBasename, contentTypeIcon } from '$lib/utils/format';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	const objects = getObjectsContext();
	const bucketName = $derived(page.params.bucket);
	let deleteTarget = $state<string | null>(null);

	$effect(() => {
		const b = bucketName;
		if (b) objects.load(b);
	});

	async function handleDelete() {
		if (!deleteTarget) return;
		await objects.remove(deleteTarget);
		deleteTarget = null;
	}
</script>

<svelte:head><title>{bucketName} — FBS</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<div class="flex items-center gap-1.5 text-sm">
		<a href="/app/buckets" class="text-surface-500 hover:text-surface-300">Buckets</a>
		<span class="text-surface-600">/</span>
		{#each objects.breadcrumbs as crumb, i (crumb.prefix)}
			{#if i > 0}<span class="text-surface-600">/</span>{/if}
			{#if i === objects.breadcrumbs.length - 1}
				<span class="font-medium text-surface-200">{crumb.label}</span>
			{:else}
				<button
					onclick={() => objects.navigateToPrefix(crumb.prefix)}
					class="text-surface-500 hover:text-surface-300">{crumb.label}</button
				>
			{/if}
		{/each}
	</div>

	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold text-surface-100">{bucketName}</h1>
			<p class="mt-0.5 text-sm text-surface-500">
				{objects.currentPrefix
					? `Prefix: ${objects.currentPrefix}`
					: `Root · ${objects.totalItems} items`}
			</p>
		</div>
		{#if objects.currentPrefix}
			<button
				onclick={() => objects.navigateUp()}
				class="flex items-center gap-1.5 rounded-lg bg-surface-800/60 px-3 py-2 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-200"
			>
				← Up
			</button>
		{/if}
	</div>

	{#if objects.error}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{objects.error}
		</div>
	{/if}

	{#if objects.isLoading}
		<div class="space-y-1">
			{#each Array.from({ length: 8 }, (_, i) => i) as i (i)}<div
					class="h-12 animate-pulse rounded-lg border border-surface-800 bg-surface-900"
				></div>{/each}
		</div>
	{:else if objects.isEmpty}
		<EmptyState
			icon="📂"
			title="Empty"
			description="Upload objects via the S3 API to see them here."
		/>
	{:else}
		<div class="overflow-hidden rounded-xl border border-surface-800 bg-surface-900">
			<div
				class="grid grid-cols-[1fr_100px_120px_40px] items-center gap-3 border-b border-surface-800 px-4 py-2.5 text-xs font-medium text-surface-500 uppercase"
			>
				<span>Name</span><span class="text-right">Size</span><span class="text-right">Modified</span
				><span></span>
			</div>
			{#each objects.commonPrefixes as prefix (prefix)}
				{@const folderName = prefix.slice(objects.currentPrefix.length).replace(/\/$/, '')}
				<button
					onclick={() => objects.navigateToPrefix(prefix)}
					class="grid w-full grid-cols-[1fr_100px_120px_40px] gap-3 border-b border-surface-800/50 px-4 py-3 text-left hover:bg-surface-850"
				>
					<div class="flex items-center gap-3">
						<span>📁</span><span class="truncate text-sm font-medium text-surface-200"
							>{folderName}/</span
						>
					</div>
					<span class="self-center text-right text-xs text-surface-600">—</span><span
						class="self-center text-right text-xs text-surface-600">—</span
					><span></span>
				</button>
			{/each}
			{#each objects.items as obj (obj.id)}
				<div
					class="group grid grid-cols-[1fr_100px_120px_40px] gap-3 border-b border-surface-800/50 px-4 py-3 hover:bg-surface-850"
				>
					<div class="flex items-center gap-3 overflow-hidden">
						<span>{contentTypeIcon(obj.contentType)}</span>
						<div class="overflow-hidden">
							<p class="truncate text-sm text-surface-200">{keyBasename(obj.key)}</p>
							<p class="truncate text-xs text-surface-600">{obj.contentType}</p>
						</div>
					</div>
					<span class="self-center text-right text-sm text-surface-400"
						>{formatBytes(obj.size)}</span
					>
					<span class="self-center text-right text-xs text-surface-500"
						>{timeAgo(obj.updatedAt)}</span
					>
					<div class="flex items-center justify-end">
						<button
							onclick={() => (deleteTarget = obj.key)}
							class="rounded-md p-1 text-surface-600 opacity-0 group-hover:opacity-100 hover:text-danger-400"
							aria-label="Delete"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
									d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
								/></svg
							>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete Object"
	description="Delete this object permanently?"
	confirmLabel="Delete"
	destructive
	onconfirm={handleDelete}
	oncancel={() => (deleteTarget = null)}
/>
