<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CopyObjectModal from '$lib/components/CopyObjectModal.svelte';
	import ObjectBrowser from '$lib/components/object-browser/ObjectBrowser.svelte';
	import ObjectMetadataModal from '$lib/components/ObjectMetadataModal.svelte';
	import DownloadOptionsModal from '$lib/components/DownloadOptionsModal.svelte';
	import BucketGrants from '$lib/components/BucketGrants.svelte';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import { getObjectsContext } from '$lib/stores/objects.svelte';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import type { ObjectMetadata, StorageObject } from '$lib/types/api';
	import { formatBytes, formatDate } from '$lib/utils/format';
	import { CalendarIcon, FolderIcon, HardDriveIcon, UploadIcon, XIcon } from 'lucide-svelte';
	import { onDestroy, untrack } from 'svelte';

	const buckets = getBucketsContext();
	const objects = getObjectsContext();
	const pageActions = getPageActionsContext();
	const connection = getConnectionContext();
	const bucketName = $derived(page.params.bucket ?? '');
	const selectedCount = $derived(objects.selectedKeys.length);
	const bucketSummary = $derived(buckets.selected?.name === bucketName ? buckets.selected : null);
	const summaryObjectCount = $derived(bucketSummary?.objectCount ?? 0);
	const summaryBytes = $derived(bucketSummary?.totalObjectBytes ?? 0);

	let activeTab = $state<'objects' | 'permissions'>('objects');
	let deleteBucketOpen = $state(false);
	let deleteSelectedOpen = $state(false);
	let copyTarget = $state<StorageObject | null>(null);
	let copyDestinationBucket = $state('');
	let copyDestinationKey = $state('');
	let copyMetadataDirective = $state<'COPY' | 'REPLACE'>('COPY');
	let copyContentType = $state('');
	let copyError = $state<string | null>(null);

	let metadataTarget = $state<StorageObject | null>(null);
	let metadataResult = $state<ObjectMetadata | null>(null);
	let isLoadingMetadata = $state(false);

	let downloadTarget = $state<StorageObject | null>(null);

	let fileInput: HTMLInputElement | undefined = $state();
	let isDragging = $state(false);
	/** Bumped after mutations so ObjectBrowser reloads the open folder */
	let browserRefreshKey = $state(0);

	// Only react to bucket name — untrack load so store mutations don't reset the folder path
	$effect(() => {
		const b = bucketName;
		if (!b) return;
		untrack(() => {
			void buckets.loadOne(b);
		});
	});

	$effect(() => {
		pageActions.setActions(topBarActions);
	});

	onDestroy(() => {
		pageActions.clearActions();
	});

	async function handleDeleteSelected() {
		const keys = [...objects.selectedKeys];
		deleteSelectedOpen = false;
		const success = await objects.removeMany(keys);
		if (success && bucketName) {
			await buckets.loadOne(bucketName);
			browserRefreshKey += 1;
		}
	}

	async function handleDeleteBucket() {
		if (!bucketName) return;
		const success = await buckets.remove(bucketName);
		deleteBucketOpen = false;
		if (success) {
			await goto(resolve('/app/buckets'));
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
			// copy() already reloads the object listing — only refresh bucket summary stats
			if (bucketName) {
				await buckets.loadOne(bucketName);
			}
		} else {
			copyError = objects.error;
		}
	}

	async function openMetadataModal(obj: StorageObject) {
		metadataTarget = obj;
		metadataResult = null;
		isLoadingMetadata = true;
		const result = await objects.getMetadata(obj.key);
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

	function closeDownloadModal() {
		downloadTarget = null;
	}

	async function handleGenerateLink(expiresIn: number): Promise<string> {
		const target = downloadTarget || metadataTarget;
		if (!target || !bucketName) return '';
		const client = connection.client;
		if (!client) return '';

		try {
			const publicUrl = await client.createPublicObjectUrl(bucketName, target.key, expiresIn);
			return publicUrl.url;
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			// Fallback to maximum standard TTL of 24h if it exceeds maximum TTL and user wanted a large duration
			if (msg.includes('exceeds maximum') && expiresIn > 86400) {
				const fallbackUrl = await client.createPublicObjectUrl(bucketName, target.key, 86400);
				return fallbackUrl.url;
			}
			throw err;
		}
	}

	function triggerUpload() {
		fileInput?.click();
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;
		const success = await objects.upload(input.files);
		// upload() already reloads the object listing — only refresh bucket summary stats
		if (success && bucketName) {
			await buckets.loadOne(bucketName);
		}
		input.value = '';
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (objects.isUploading) return;
		const files = event.dataTransfer?.files;
		if (!files?.length) return;
		const success = await objects.upload(files);
		// upload() already reloads the object listing — only refresh bucket summary stats
		if (success && bucketName) {
			await buckets.loadOne(bucketName);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (objects.isUploading) return;
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}
</script>

{#snippet topBarActions()}
	<!-- Compact Stats (formerly the 3 cards) -->
	{#if bucketSummary}
		<div class="hidden items-center gap-4 border-r border-surface-800 pr-4 text-xs md:flex">
			<div class="flex items-center gap-1.5">
				<FolderIcon size={14} class="text-accent-400" />
				<span class="text-surface-500">Objects:</span>
				<span class="font-medium text-surface-200">{summaryObjectCount.toLocaleString()}</span>
			</div>
			<div class="h-3 w-px bg-surface-800"></div>
			<div class="flex items-center gap-1.5">
				<HardDriveIcon size={14} class="text-accent-400" />
				<span class="text-surface-500">Storage:</span>
				<span class="font-medium text-surface-200">{formatBytes(summaryBytes)}</span>
			</div>
			<div class="h-3 w-px bg-surface-800"></div>
			<div class="flex items-center gap-1.5">
				<CalendarIcon size={14} class="text-accent-400" />
				<span class="text-surface-500">Created:</span>
				<span class="font-medium text-surface-200">
					{bucketSummary?.createdAt ? formatDate(bucketSummary.createdAt) : 'Loading...'}
				</span>
			</div>
		</div>
	{/if}

	<!-- Action Buttons -->
	<div class="flex items-center gap-2">
		{#if activeTab === 'objects'}
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
		{/if}
		<button
			onclick={() => (deleteBucketOpen = true)}
			class="rounded-lg bg-danger-500/15 px-3.5 py-1.5 text-sm font-medium text-danger-400 transition-colors hover:bg-danger-500/25"
		>
			Delete Bucket
		</button>
	</div>
{/snippet}

<svelte:head><title>{bucketName} — FBS</title></svelte:head>

<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
	{#if objects.error}
		<div
			class="shrink-0 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400"
		>
			{objects.error}
		</div>
	{/if}
	{#if buckets.error}
		<div
			class="shrink-0 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400"
		>
			{buckets.error}
		</div>
	{/if}

	{#if objects.isUploading}
		<div class="shrink-0 rounded-xl border border-accent-500/20 bg-accent-500/5 px-4 py-3">
			<div class="mb-2 flex items-center gap-3">
				<div
					class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent-500/30 border-t-accent-400"
				></div>
				<p class="min-w-0 flex-1 truncate text-sm text-accent-400">
					{objects.uploadProgress || 'Uploading...'}
				</p>
				<span class="shrink-0 text-xs font-medium text-accent-300">
					{Math.round(objects.uploadPercent)}%
				</span>
				<button
					onclick={() => objects.cancelUpload()}
					class="shrink-0 rounded-md p-1.5 text-accent-300 transition-colors hover:bg-accent-500/15 hover:text-accent-100"
					aria-label="Cancel upload"
				>
					<XIcon size={14} />
				</button>
			</div>
			<div class="h-1.5 overflow-hidden rounded-full bg-surface-800">
				<div
					class="h-full rounded-full bg-accent-400 transition-[width] duration-150"
					style:width={objects.uploadPercent + '%'}
				></div>
			</div>
		</div>
	{/if}

	<!-- Tab Bar -->
	<div class="mb-2 flex shrink-0 border-b border-surface-800">
		<button
			onclick={() => (activeTab = 'objects')}
			class="border-b-2 px-5 py-2.5 text-xs font-semibold transition-colors {activeTab === 'objects'
				? 'border-accent-500 font-bold text-accent-400'
				: 'border-transparent text-surface-400 hover:text-surface-200'}"
		>
			Objects
		</button>
		<button
			onclick={() => (activeTab = 'permissions')}
			class="border-b-2 px-5 py-2.5 text-xs font-semibold transition-colors {activeTab ===
			'permissions'
				? 'border-accent-500 font-bold text-accent-400'
				: 'border-transparent text-surface-400 hover:text-surface-200'}"
		>
			Permissions & Sharing
		</button>
	</div>

	{#if activeTab === 'objects'}
		<div
			class="relative flex min-h-0 flex-1 flex-col overflow-hidden"
			role="region"
			aria-label="Object browser"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			{#if isDragging && !objects.isUploading}
				<div
					class="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-accent-500/50 bg-accent-500/5 backdrop-blur-sm"
				>
					<div class="text-center">
						<UploadIcon size={32} class="mx-auto mb-2 text-accent-400" />
						<p class="text-sm font-medium text-accent-400">Drop files to upload here</p>
						{#if objects.currentPrefix}
							<p class="mt-1 text-xs text-surface-500">into {objects.currentPrefix}</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if bucketName}
				<ObjectBrowser
					{bucketName}
					refreshKey={browserRefreshKey}
					onopenmetadata={openMetadataModal}
					oncopyobject={openCopyModal}
					onopendownload={(obj) => (downloadTarget = obj)}
				/>
			{/if}
		</div>
	{:else}
		<div class="min-h-0 flex-1 overflow-y-auto">
			<BucketGrants {bucketName} />
		</div>
	{/if}
</div>

<input bind:this={fileInput} type="file" multiple class="hidden" onchange={handleFileSelect} />

<ObjectMetadataModal
	open={metadataTarget !== null}
	metadata={metadataResult}
	isLoading={isLoadingMetadata}
	onclose={closeMetadataModal}
	ondownload={() => {
		if (metadataResult) {
			downloadTarget = metadataTarget;
		}
		closeMetadataModal();
	}}
/>

<DownloadOptionsModal
	open={downloadTarget !== null}
	object={downloadTarget}
	onclose={closeDownloadModal}
	ondownload={(expiresIn) => {
		if (downloadTarget) void objects.download(downloadTarget.key, expiresIn);
		closeDownloadModal();
	}}
	ongeneratelink={handleGenerateLink}
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
