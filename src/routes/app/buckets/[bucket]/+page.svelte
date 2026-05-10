<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CopyObjectModal from '$lib/components/CopyObjectModal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FileTypeIcon from '$lib/components/FileTypeIcon.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import { getObjectsContext } from '$lib/stores/objects.svelte';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';
	import type { StorageObject } from '$lib/types/api';
	import {
		contentTypeIconName,
		formatBytes,
		formatDate,
		keyBasename,
		timeAgo
	} from '$lib/utils/format';
	import { FolderOpenIcon, FolderIcon, ArrowLeftIcon } from 'lucide-svelte';
	import { onDestroy } from 'svelte';

	const buckets = getBucketsContext();
	const objects = getObjectsContext();
	const pageActions = getPageActionsContext();
	const bucketName = $derived(page.params.bucket);
	const selectedCount = $derived(objects.selectedKeys.length);
	const bucketSummary = $derived(buckets.selected?.name === bucketName ? buckets.selected : null);
	const summaryObjectCount = $derived(bucketSummary?.objectCount ?? objects.items.length);
	const summaryBytes = $derived(
		bucketSummary?.totalObjectBytes ?? objects.items.reduce((sum, object) => sum + object.size, 0)
	);

	let deleteTarget = $state<string | null>(null);
	let deleteBucketOpen = $state(false);
	let deleteSelectedOpen = $state(false);
	let copyTarget = $state<StorageObject | null>(null);
	let copyDestinationBucket = $state('');
	let copyDestinationKey = $state('');
	let copyMetadataDirective = $state<'COPY' | 'REPLACE'>('COPY');
	let copyContentType = $state('');
	let copyError = $state<string | null>(null);

	$effect(() => {
		const b = bucketName;
		if (b) {
			objects.load(b);
			buckets.loadOne(b);
		}
	});

	$effect(() => {
		pageActions.setActions(topBarActions);
	});

	onDestroy(() => {
		pageActions.clearActions();
	});

	async function handleDelete() {
		if (!deleteTarget) return;
		const bucket = bucketName;
		await objects.remove(deleteTarget);
		deleteTarget = null;
		if (bucket) await buckets.loadOne(bucket);
	}

	async function handleDeleteSelected() {
		const bucket = bucketName;
		const keys = [...objects.selectedKeys];
		deleteSelectedOpen = false;
		const success = await objects.removeMany(keys);
		if (success && bucket) await buckets.loadOne(bucket);
	}

	async function handleDeleteBucket() {
		const bucket = bucketName;
		if (!bucket) return;

		const success = await buckets.remove(bucket);
		deleteBucketOpen = false;
		if (success) {
			await goto(resolve('/app/buckets'));
		}
	}

	function toggleVisibleSelection() {
		if (objects.allVisibleSelected) {
			objects.clearSelection();
		} else {
			objects.selectVisible();
		}
	}

	function openCopyModal(object: StorageObject) {
		copyTarget = object;
		copyDestinationBucket = object.bucketName;
		copyDestinationKey = object.key;
		copyMetadataDirective = 'COPY';
		copyContentType = object.contentType;
		copyError = null;
	}

	function closeCopyModal() {
		copyTarget = null;
		copyError = null;
	}

	async function handleCopy(event: Event) {
		event.preventDefault();
		if (!copyTarget) return;

		const destinationBucket = copyDestinationBucket.trim();
		const destinationKey = copyDestinationKey.trim();
		if (!destinationBucket || !destinationKey) {
			copyError = 'Destination bucket and key are required';
			return;
		}

		const success = await objects.copy(
			copyTarget.key,
			destinationKey,
			destinationBucket,
			copyMetadataDirective,
			copyMetadataDirective === 'REPLACE' ? copyContentType.trim() || undefined : undefined
		);
		if (success) {
			closeCopyModal();
			const bucket = bucketName;
			if (bucket) await buckets.loadOne(bucket);
		} else {
			copyError = objects.error;
		}
	}
</script>

{#snippet topBarActions()}
	{#if objects.currentPrefix}
		<button
			onclick={() => objects.navigateUp()}
			class="flex items-center gap-1.5 rounded-lg bg-surface-800/60 px-3 py-1.5 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-200"
		>
			<ArrowLeftIcon size={14} /> Up
		</button>
	{/if}
	{#if selectedCount > 0}
		<button
			onclick={() => (deleteSelectedOpen = true)}
			class="rounded-lg bg-danger-500/15 px-3.5 py-1.5 text-sm font-medium text-danger-400 transition-colors hover:bg-danger-500/25"
		>
			Delete Selected ({selectedCount})
		</button>
	{/if}
	<button
		onclick={() => (deleteBucketOpen = true)}
		class="rounded-lg bg-danger-500/15 px-3.5 py-1.5 text-sm font-medium text-danger-400 transition-colors hover:bg-danger-500/25"
	>
		Delete Bucket
	</button>
{/snippet}

<svelte:head><title>{bucketName} — FBS</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	{#if objects.error}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{objects.error}
		</div>
	{/if}
	{#if buckets.error}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{buckets.error}
		</div>
	{/if}

	<div class="grid gap-3 rounded-xl border border-surface-800 bg-surface-900 p-4 sm:grid-cols-3">
		<div>
			<p class="text-xs text-surface-500">Objects</p>
			<p class="mt-1 text-lg font-semibold text-surface-100">
				{summaryObjectCount.toLocaleString()}
			</p>
		</div>
		<div>
			<p class="text-xs text-surface-500">Storage</p>
			<p class="mt-1 text-lg font-semibold text-surface-100">{formatBytes(summaryBytes)}</p>
		</div>
		<div>
			<p class="text-xs text-surface-500">Created</p>
			<p class="mt-1 text-sm font-medium text-surface-200">
				{bucketSummary?.createdAt ? formatDate(bucketSummary.createdAt) : 'Loading...'}
			</p>
		</div>
	</div>

	{#if objects.isLoading}
		<div class="rounded-xl border border-surface-800 bg-surface-900">
			<LoadingSpinner label="Loading objects..." minHeight="14rem" />
		</div>
	{:else if objects.isEmpty}
		<EmptyState
			icon={FolderOpenIcon}
			title="Empty"
			description="Upload objects via the S3 API to see them here."
		/>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-surface-800 bg-surface-900">
			<div class="min-w-[760px]">
				<div
					class="grid grid-cols-[32px_1fr_100px_120px_88px] items-center gap-3 border-b border-surface-800 px-4 py-2.5 text-xs font-medium text-surface-500 uppercase"
				>
					<button
						onclick={toggleVisibleSelection}
						aria-label="Select visible objects"
						class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors {objects.allVisibleSelected
							? 'border-accent-500 bg-accent-500 text-white'
							: 'border-surface-600 bg-surface-800 hover:border-surface-500'}"
					>
						{#if objects.allVisibleSelected}
							<svg
								width="10"
								height="10"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
							>
						{/if}
					</button>
					<span>Name</span><span class="text-right">Size</span><span class="text-right"
						>Modified</span
					><span></span>
				</div>
				{#each objects.commonPrefixes as prefix (prefix)}
					{@const folderName = prefix.slice(objects.currentPrefix.length).replace(/\/$/, '')}
					<button
						onclick={() => objects.navigateToPrefix(prefix)}
						class="grid w-full grid-cols-[32px_1fr_100px_120px_88px] gap-3 border-b border-surface-800/50 px-4 py-3 text-left hover:bg-surface-850"
					>
						<span></span>
						<div class="flex items-center gap-3">
							<FolderIcon size={16} class="shrink-0 text-surface-400" /><span
								class="truncate text-sm font-medium text-surface-200">{folderName}/</span
							>
						</div>
						<span class="self-center text-right text-xs text-surface-600">—</span><span
							class="self-center text-right text-xs text-surface-600">—</span
						><span></span>
					</button>
				{/each}
				{#each objects.items as obj (obj.id)}
					<div
						class="group grid grid-cols-[32px_1fr_100px_120px_88px] gap-3 border-b border-surface-800/50 px-4 py-3 hover:bg-surface-850"
					>
						<div class="flex items-center">
							<button
								onclick={() => objects.toggleSelected(obj.key)}
								aria-label="Select {obj.key}"
								class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors {objects.selectedKeys.includes(
									obj.key
								)
									? 'border-accent-500 bg-accent-500 text-white'
									: 'border-surface-600 bg-surface-800 hover:border-surface-500'}"
							>
								{#if objects.selectedKeys.includes(obj.key)}
									<svg
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
										stroke-linecap="round"
										stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
									>
								{/if}
							</button>
						</div>
						<div class="flex items-center gap-3 overflow-hidden">
							<FileTypeIcon
								type={contentTypeIconName(obj.contentType)}
								size={16}
								class="shrink-0 text-surface-400"
							/>
							<div class="overflow-hidden">
								<p class="truncate text-sm text-surface-200">{keyBasename(obj.key)}</p>
								<p class="truncate text-xs text-surface-600">{obj.contentType}</p>
							</div>
						</div>
						<span class="self-center text-right text-sm text-surface-400">
							{formatBytes(obj.size)}
						</span>
						<span class="self-center text-right text-xs text-surface-500">
							{timeAgo(obj.updatedAt)}
						</span>
						<div class="flex items-center justify-end gap-1">
							<button
								onclick={() => openCopyModal(obj)}
								class="rounded-md px-2 py-1 text-xs text-surface-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-800 hover:text-surface-200"
							>
								Copy
							</button>
							<button
								onclick={() => (deleteTarget = obj.key)}
								class="rounded-md p-1 text-surface-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-danger-500/10 hover:text-danger-400"
								aria-label="Delete"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
										d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
									/>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
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

<CopyObjectModal
	open={copyTarget !== null}
	source={copyTarget}
	bind:destinationBucket={copyDestinationBucket}
	bind:destinationKey={copyDestinationKey}
	bind:metadataDirective={copyMetadataDirective}
	bind:contentType={copyContentType}
	error={copyError}
	onsubmit={handleCopy}
	onclose={closeCopyModal}
/>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete Object"
	description="Delete this object permanently?"
	confirmLabel="Delete"
	destructive
	onconfirm={handleDelete}
	oncancel={() => (deleteTarget = null)}
/>

<ConfirmDialog
	open={deleteSelectedOpen}
	title="Delete Objects"
	description="Delete {selectedCount} selected objects? This cannot be undone."
	confirmLabel="Delete Objects"
	destructive
	onconfirm={handleDeleteSelected}
	oncancel={() => (deleteSelectedOpen = false)}
/>

<ConfirmDialog
	open={deleteBucketOpen}
	title="Delete Bucket"
	description="Delete &quot;{bucketName}&quot; and all objects inside it? This cannot be undone."
	confirmLabel="Delete Bucket"
	destructive
	onconfirm={handleDeleteBucket}
	oncancel={() => (deleteBucketOpen = false)}
/>
