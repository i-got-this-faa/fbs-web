<script lang="ts">
	import { page } from '$app/state';
	import { getObjectsContext } from '$lib/stores/objects.svelte';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';
	import { formatBytes, timeAgo, keyBasename, contentTypeIcon } from '$lib/utils/format';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { onDestroy } from 'svelte';

	const objects = getObjectsContext();
	const pageActions = getPageActionsContext();
	const bucketName = $derived(page.params.bucket);
	let deleteTarget = $state<string | null>(null);

	$effect(() => {
		const b = bucketName;
		if (b) objects.load(b);
	});

	// Push the "Up" button to the TopBar when inside a prefix
	$effect(() => {
		if (objects.currentPrefix) {
			pageActions.setActions(topBarActions);
		} else {
			pageActions.clearActions();
		}
	});

	onDestroy(() => {
		pageActions.clearActions();
	});

	async function handleDelete() {
		if (!deleteTarget) return;
		await objects.remove(deleteTarget);
		deleteTarget = null;
	}
</script>

{#snippet topBarActions()}
	<button
		onclick={() => objects.navigateUp()}
		class="flex items-center gap-1.5 rounded-lg bg-surface-800/60 px-3 py-1.5 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-200"
	>
		← Up
	</button>
{/snippet}

<svelte:head><title>{bucketName} — FBS</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	{#if objects.error}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{objects.error}
		</div>
	{/if}

	{#if objects.isLoading}
		<div class="rounded-xl border border-surface-800 bg-surface-900">
			<LoadingSpinner label="Loading objects..." minHeight="14rem" />
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
		{#if objects.isTruncated}
			<div class="flex justify-center">
				<button
					onclick={() => objects.loadMore()}
					disabled={objects.isLoadingMore}
					class="rounded-lg bg-surface-800/60 px-4 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-800 hover:text-surface-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{objects.isLoadingMore ? 'Loading...' : 'Load More'}
				</button>
			</div>
		{/if}
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
