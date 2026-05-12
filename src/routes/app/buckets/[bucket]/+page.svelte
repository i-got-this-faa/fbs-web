<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CopyObjectModal from '$lib/components/CopyObjectModal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FileTypeIcon from '$lib/components/FileTypeIcon.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ObjectMetadataModal from '$lib/components/ObjectMetadataModal.svelte';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import { getObjectsContext } from '$lib/stores/objects.svelte';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';
	import type { ObjectMetadata, StorageObject } from '$lib/types/api';
	import {
		contentTypeIconName,
		formatBytes,
		formatDate,
		keyBasename,
		timeAgo
	} from '$lib/utils/format';
	import {
		FolderOpenIcon,
		FolderIcon,
		ArrowLeftIcon,
		DownloadIcon,
		UploadIcon,
		InfoIcon,
		HardDriveIcon,
		CalendarIcon,
		CopyIcon
	} from 'lucide-svelte';
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

	let deleteBucketOpen = $state(false);
	let deleteSelectedOpen = $state(false);
	let copyTarget = $state<StorageObject | null>(null);
	let copyDestinationBucket = $state('');
	let copyDestinationKey = $state('');
	let copyMetadataDirective = $state<'COPY' | 'REPLACE'>('COPY');
	let copyContentType = $state('');
	let copyError = $state<string | null>(null);

	// Metadata modal
	let metadataTarget = $state<StorageObject | null>(null);
	let metadataResult = $state<ObjectMetadata | null>(null);
	let isLoadingMetadata = $state(false);

	// Upload
	let fileInput: HTMLInputElement | undefined = $state();
	let isDragging = $state(false);

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

	async function openMetadataModal(obj: StorageObject) {
		metadataTarget = obj;
		metadataResult = null;
		isLoadingMetadata = true;
		const result = await objects.getMetadata(obj.key);
		// If we still have the same target, update
		if (metadataTarget?.key === obj.key) {
			metadataResult = result;
			isLoadingMetadata = false;
		}
	}

	function closeMetadataModal() {
		metadataTarget = null;
		metadataResult = null;
		isLoadingMetadata = false;
	}

	function triggerUpload() {
		fileInput?.click();
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;
		const success = await objects.upload(input.files);
		if (success && bucketName) await buckets.loadOne(bucketName);
		input.value = '';
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const files = event.dataTransfer?.files;
		if (!files?.length) return;
		const success = await objects.upload(files);
		if (success && bucketName) await buckets.loadOne(bucketName);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
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
		onclick={triggerUpload}
		disabled={objects.isUploading}
		class="flex items-center gap-1.5 rounded-lg bg-accent-500/15 px-3.5 py-1.5 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25 disabled:opacity-50"
	>
		<UploadIcon size={14} />
		{objects.isUploading ? 'Uploading...' : 'Upload'}
	</button>
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

	<div class="grid gap-3 sm:grid-cols-3">
		<div
			class="flex items-center gap-3 rounded-xl border border-surface-800 bg-surface-900 px-4 py-3.5"
		>
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10">
				<FolderIcon size={18} class="text-accent-400" />
			</div>
			<div>
				<p class="text-xs text-surface-500">Objects</p>
				<p class="text-lg font-semibold text-surface-100">{summaryObjectCount.toLocaleString()}</p>
			</div>
		</div>
		<div
			class="flex items-center gap-3 rounded-xl border border-surface-800 bg-surface-900 px-4 py-3.5"
		>
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10">
				<HardDriveIcon size={18} class="text-accent-400" />
			</div>
			<div>
				<p class="text-xs text-surface-500">Storage</p>
				<p class="text-lg font-semibold text-surface-100">{formatBytes(summaryBytes)}</p>
			</div>
		</div>
		<div
			class="flex items-center gap-3 rounded-xl border border-surface-800 bg-surface-900 px-4 py-3.5"
		>
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10">
				<CalendarIcon size={18} class="text-accent-400" />
			</div>
			<div>
				<p class="text-xs text-surface-500">Created</p>
				<p class="text-sm font-medium text-surface-200">
					{bucketSummary?.createdAt ? formatDate(bucketSummary.createdAt) : 'Loading...'}
				</p>
			</div>
		</div>
	</div>

	{#if objects.breadcrumbs.length > 1}
		<nav class="flex items-center gap-1 text-sm">
			{#each objects.breadcrumbs as crumb, i (crumb.prefix + crumb.label)}
				{#if i > 0}
					<span class="text-surface-600">/</span>
				{/if}
				{#if i < objects.breadcrumbs.length - 1}
					<button
						onclick={() => objects.navigateToPrefix(crumb.prefix)}
						class="rounded px-1.5 py-0.5 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
					>
						{crumb.label}
					</button>
				{:else}
					<span class="rounded px-1.5 py-0.5 font-medium text-surface-200">{crumb.label}</span>
				{/if}
			{/each}
		</nav>
	{/if}

	<div
		class="relative"
		role="region"
		aria-label="Object listing"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		{#if isDragging}
			<div
				class="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent-500/50 bg-accent-500/5 backdrop-blur-sm"
			>
				<div class="text-center">
					<UploadIcon size={32} class="mx-auto mb-2 text-accent-400" />
					<p class="text-sm font-medium text-accent-400">Drop files to upload</p>
				</div>
			</div>
		{/if}

		{#if objects.isUploading}
			<div
				class="mb-4 flex items-center gap-3 rounded-xl border border-accent-500/20 bg-accent-500/5 px-4 py-3"
			>
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-accent-500/30 border-t-accent-400"
				></div>
				<p class="text-sm text-accent-400">{objects.uploadProgress || 'Uploading...'}</p>
			</div>
		{/if}

		{#if objects.isLoading}
			<div class="rounded-xl border border-surface-800 bg-surface-900">
				<LoadingSpinner label="Loading objects..." minHeight="14rem" />
			</div>
		{:else if objects.isEmpty}
			<EmptyState
				icon={FolderOpenIcon}
				title="Empty"
				description="Upload objects via the S3 API or drag & drop files here."
			/>
		{:else}
			<div class="overflow-x-auto rounded-xl border border-surface-800 bg-surface-900">
				<div class="min-w-[760px]">
					<div
						class="grid grid-cols-[32px_1fr_80px_100px_96px] items-center gap-3 border-b border-surface-800 px-4 py-2.5 text-xs font-medium text-surface-500 uppercase"
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
						><span class="text-right">Actions</span>
					</div>
					{#each objects.commonPrefixes as prefix (prefix)}
						{@const folderName = prefix.slice(objects.currentPrefix.length).replace(/\/$/, '')}
						<button
							onclick={() => objects.navigateToPrefix(prefix)}
							class="grid w-full grid-cols-[32px_1fr_80px_100px_96px] gap-3 border-b border-surface-800/50 px-4 py-3 text-left hover:bg-surface-850"
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
							class="group grid grid-cols-[32px_1fr_80px_100px_96px] gap-3 border-b border-surface-800/50 px-4 py-3 hover:bg-surface-850"
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
							<button
								onclick={() => openMetadataModal(obj)}
								class="flex items-center gap-3 overflow-hidden text-left"
							>
								<FileTypeIcon
									type={contentTypeIconName(obj.contentType)}
									size={16}
									class="shrink-0 text-surface-400"
								/>
								<div class="overflow-hidden">
									<p class="truncate text-sm text-surface-200">{keyBasename(obj.key)}</p>
									<p class="truncate text-xs text-surface-600">{obj.contentType}</p>
								</div>
							</button>
							<span class="self-center text-right text-sm text-surface-400">
								{formatBytes(obj.size)}
							</span>
							<span class="self-center text-right text-xs text-surface-500">
								{timeAgo(obj.updatedAt)}
							</span>
							<div class="flex items-center justify-end gap-1">
								<button
									onclick={() => openMetadataModal(obj)}
									class="rounded-md p-1.5 text-surface-600 transition-colors hover:bg-surface-800 hover:text-surface-200"
									aria-label="View details"
								>
									<InfoIcon size={14} />
								</button>
								<button
									onclick={() => objects.download(obj.key)}
									class="rounded-md p-1.5 text-surface-600 transition-colors hover:bg-surface-800 hover:text-surface-200"
									aria-label="Download"
								>
									<DownloadIcon size={14} />
								</button>
								<button
									onclick={() => openCopyModal(obj)}
									class="rounded-md p-1.5 text-surface-600 transition-colors hover:bg-surface-800 hover:text-surface-200"
									aria-label="Copy"
								>
									<CopyIcon size={14} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
			{#if objects.isTruncated}
				<div class="flex justify-center pt-4">
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
</div>

<input bind:this={fileInput} type="file" multiple class="hidden" onchange={handleFileSelect} />

<ObjectMetadataModal
	open={metadataTarget !== null}
	metadata={metadataResult}
	isLoading={isLoadingMetadata}
	onclose={closeMetadataModal}
	ondownload={() => {
		if (metadataTarget) objects.download(metadataTarget.key);
		closeMetadataModal();
	}}
/>

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
