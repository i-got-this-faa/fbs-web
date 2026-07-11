<script lang="ts">
	import FileTypeIcon from '$lib/components/FileTypeIcon.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { getObjectsContext } from '$lib/stores/objects.svelte';
	import type { StorageObject } from '$lib/types/api';
	import { contentTypeIconName, formatBytes, keyBasename, timeAgo } from '$lib/utils/format';
	import { ChevronRightIcon, CopyIcon, DownloadIcon, FolderIcon, SearchIcon } from 'lucide-svelte';
	import { untrack } from 'svelte';

	interface Props {
		bucketName: string;
		refreshKey?: number;
		onopenmetadata: (object: StorageObject) => void;
		oncopyobject: (object: StorageObject) => void;
	}

	const { bucketName, refreshKey = 0, onopenmetadata, oncopyobject }: Props = $props();

	const objects = getObjectsContext();
	let searchQuery = $state('');

	function getFolderDisplayName(folderPrefix: string, parentPrefix: string): string {
		return folderPrefix.slice(parentPrefix.length).replace(/\/$/, '');
	}

	const filteredFolders = $derived(
		objects.commonPrefixes.filter((folder) => {
			const name = getFolderDisplayName(folder, objects.currentPrefix);
			return !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase());
		})
	);

	const filteredObjects = $derived(
		objects.items.filter((obj) => {
			const name = obj.key.split('/').pop() ?? obj.key;
			return !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase());
		})
	);

	const filteredObjectKeys = $derived(filteredObjects.map((obj) => obj.key));
	const allFilteredSelected = $derived(objects.areAllSelected(filteredObjectKeys));
	const hasFilteredItems = $derived(filteredFolders.length > 0 || filteredObjects.length > 0);
	/** Full spinner only on initial empty load; keep table during same-folder refresh */
	const showFullSpinner = $derived(objects.isLoading && !objects.isLoadingMore && objects.isEmpty);

	let lastBucket = $state('');

	// Clear local filter when navigating folders or switching buckets
	$effect(() => {
		void bucketName;
		void objects.currentPrefix;
		searchQuery = '';
	});

	$effect(() => {
		const bucket = bucketName;
		if (!bucket) return;
		untrack(() => {
			if (bucket !== lastBucket) {
				lastBucket = bucket;
				void objects.load(bucket, '');
			}
		});
	});

	$effect(() => {
		const key = refreshKey;
		if (key === 0 || !bucketName) return;
		untrack(() => {
			void objects.load(bucketName, objects.currentPrefix || '');
		});
	});

	function handleToggleAll() {
		if (filteredObjectKeys.length === 0) return;
		if (allFilteredSelected) {
			objects.deselectKeys(filteredObjectKeys);
		} else {
			// Preserve selections outside the filter; add filtered keys
			const existing = objects.selectedKeys;
			const toAdd = filteredObjectKeys.filter((key) => !existing.includes(key));
			objects.selectKeys([...existing, ...toAdd]);
		}
	}

	function handleLoadMore() {
		objects.loadMore();
	}
</script>

<div
	class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-800 bg-surface-900"
>
	<!-- Local breadcrumbs and Search -->
	<div
		class="flex flex-col gap-3 border-b border-surface-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
	>
		<!-- Breadcrumbs -->
		<nav class="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Bucket navigation">
			{#each objects.breadcrumbs as crumb, i (crumb.prefix)}
				{#if i > 0}
					<span class="text-surface-600">/</span>
				{/if}
				{#if i === objects.breadcrumbs.length - 1}
					<span class="font-medium text-surface-200">{crumb.label}</span>
				{:else}
					<button
						onclick={() => objects.navigateToPrefix(crumb.prefix)}
						class="text-surface-400 transition-colors hover:text-accent-400"
					>
						{crumb.label}
					</button>
				{/if}
			{/each}
		</nav>

		<!-- Search Input -->
		<div class="relative w-full sm:w-64">
			<SearchIcon size={14} class="absolute top-1/2 left-3 -translate-y-1/2 text-surface-500" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Filter loaded items…"
				class="w-full rounded-lg border border-surface-800 bg-surface-950 py-1.5 pr-3 pl-9 text-sm text-surface-200 placeholder-surface-500 transition-colors outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/30"
			/>
		</div>
	</div>

	<!-- Files List Table -->
	<div class="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
		{#if showFullSpinner}
			<LoadingSpinner label="Loading objects..." minHeight="14rem" />
		{:else if !hasFilteredItems}
			<div class="p-6">
				<EmptyState
					icon={FolderIcon}
					title="No items found"
					description={searchQuery
						? objects.isTruncated
							? 'No matches in loaded items. Load more to search further, or clear the filter.'
							: 'Try refining your filter.'
						: 'Upload files or drag them here.'}
				/>
			</div>
			{#if objects.isTruncated}
				<div class="flex justify-center border-t border-surface-800 p-4">
					<button
						onclick={handleLoadMore}
						disabled={objects.isLoadingMore}
						class="flex items-center gap-2 rounded-lg bg-surface-800 px-4 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-700 hover:text-surface-100 disabled:opacity-50"
					>
						{#if objects.isLoadingMore}
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-surface-500 border-t-surface-300"
							></div>
							Loading...
						{:else}
							Load More
						{/if}
					</button>
				</div>
			{/if}
		{:else}
			<div class="min-w-[760px]">
				<!-- Table Header -->
				<div
					class="sticky top-0 z-10 grid grid-cols-[40px_1fr_120px_140px_100px] items-center gap-3 border-b border-surface-800 bg-surface-900 px-4 py-2.5 text-xs font-semibold tracking-wider text-surface-500 uppercase"
				>
					<button
						onclick={handleToggleAll}
						aria-label="Select all visible objects"
						disabled={filteredObjectKeys.length === 0}
						class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-40 {allFilteredSelected
							? 'border-accent-500 bg-accent-500 text-white'
							: 'border-surface-600 bg-surface-800 hover:border-surface-500'}"
					>
						{#if allFilteredSelected}
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
					<span>Name</span>
					<span class="text-right">Size</span>
					<span class="text-right">Modified</span>
					<span class="text-right">Actions</span>
				</div>

				<!-- Table Body -->
				<div
					class="divide-y divide-surface-800/45 bg-surface-900/50 {objects.isLoading &&
					!objects.isLoadingMore
						? 'opacity-70'
						: ''}"
				>
					<!-- Folders -->
					{#each filteredFolders as folderPrefix (folderPrefix)}
						{@const name = getFolderDisplayName(folderPrefix, objects.currentPrefix)}
						{@const stats = objects.folderStats[folderPrefix]}
						<button
							type="button"
							onclick={() => objects.navigateToPrefix(folderPrefix)}
							class="grid w-full grid-cols-[40px_1fr_120px_140px_100px] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-850/80"
						>
							<span></span>
							<div class="flex min-w-0 items-center gap-3">
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400"
								>
									<FolderIcon size={15} />
								</div>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-surface-200">{name}</p>
									<p class="truncate text-xs text-surface-500">
										{#if stats?.isLoading}
											Counting…
										{:else if stats?.error}
											Unavailable
										{:else if stats}
											{stats.objectCount.toLocaleString()}{stats.isPartial ? '+' : ''} objects
										{:else}
											Folder
										{/if}
									</p>
								</div>
							</div>
							<span class="text-right text-sm text-surface-400 tabular-nums">
								{#if stats && !stats.isLoading && !stats.error && stats.objectCount > 0}
									{formatBytes(stats.size)}{stats.isPartial ? '+' : ''}
								{:else}
									—
								{/if}
							</span>
							<span class="text-right text-xs text-surface-500">
								{#if stats?.updatedAt && !stats.isLoading && !stats.error}
									{timeAgo(stats.updatedAt)}
								{:else}
									—
								{/if}
							</span>
							<div class="flex justify-end pr-2 text-surface-600">
								<ChevronRightIcon size={14} />
							</div>
						</button>
					{/each}

					<!-- Files (Objects) -->
					{#each filteredObjects as obj (obj.id)}
						{@const checked = objects.selectedKeys.includes(obj.key)}
						<div
							class="grid grid-cols-[40px_1fr_120px_140px_100px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-850/80"
						>
							<div class="flex items-center">
								<button
									onclick={() => objects.toggleSelected(obj.key)}
									aria-label="Select {obj.key}"
									class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors {checked
										? 'border-accent-500 bg-accent-500 text-white'
										: 'border-surface-600 bg-surface-800 hover:border-surface-500'}"
								>
									{#if checked}
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

							<!-- Click name to open details modal -->
							<button
								type="button"
								onclick={() => onopenmetadata(obj)}
								class="group flex min-w-0 items-center gap-3 text-left outline-none"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-800 text-surface-400 transition-colors group-hover:bg-surface-700 group-hover:text-surface-200"
								>
									<FileTypeIcon type={contentTypeIconName(obj.contentType)} size={14} />
								</div>
								<div class="min-w-0">
									<p
										class="truncate text-sm font-medium text-surface-200 transition-colors group-hover:text-accent-400"
									>
										{keyBasename(obj.key)}
									</p>
									<p class="truncate text-xs text-surface-500">{obj.contentType}</p>
								</div>
							</button>

							<span class="text-right text-sm text-surface-400 tabular-nums"
								>{formatBytes(obj.size)}</span
							>
							<span class="text-right text-xs text-surface-500">{timeAgo(obj.updatedAt)}</span>

							<div class="flex items-center justify-end gap-1">
								<button
									onclick={() => void objects.download(obj.key)}
									class="rounded-md p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-200"
									aria-label="Download"
								>
									<DownloadIcon size={14} />
								</button>
								<button
									onclick={() => oncopyobject(obj)}
									class="rounded-md p-1.5 text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-200"
									aria-label="Copy"
								>
									<CopyIcon size={14} />
								</button>
							</div>
						</div>
					{/each}
				</div>

				<!-- Load More for Truncated Listings -->
				{#if objects.isTruncated}
					<div class="flex justify-center border-t border-surface-800 p-4">
						<button
							onclick={handleLoadMore}
							disabled={objects.isLoadingMore}
							class="flex items-center gap-2 rounded-lg bg-surface-800 px-4 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-700 hover:text-surface-100 disabled:opacity-50"
						>
							{#if objects.isLoadingMore}
								<div
									class="h-4 w-4 animate-spin rounded-full border-2 border-surface-500 border-t-surface-300"
								></div>
								Loading...
							{:else}
								Load More
							{/if}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
