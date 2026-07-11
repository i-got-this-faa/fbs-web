import { createContext } from 'svelte';
import type {
	ListObjectsOptions,
	ObjectListing,
	ObjectMetadata,
	StorageObject,
	UploadProgress
} from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

/** Aggregated stats for a common-prefix "folder" */
export interface FolderStats {
	size: number;
	objectCount: number;
	updatedAt: string | null;
	/** True when listing was truncated — counts/size are lower bounds */
	isPartial: boolean;
	isLoading: boolean;
	/** True when the stats request failed (distinct from empty folder) */
	error?: boolean;
}

const FOLDER_STATS_PAGE_SIZE = 500;
const FOLDER_STATS_CONCURRENCY = 4;
/** Cap pages per folder to limit API amplification on wide directories */
const FOLDER_STATS_MAX_PAGES = 2;

class ObjectsStore {
	items = $state<StorageObject[]>([]);
	commonPrefixes = $state<string[]>([]);
	/** Stats keyed by common-prefix path (e.g. "docs/") */
	folderStats = $state<Record<string, FolderStats>>({});
	isTruncated = $state(false);
	isLoading = $state(false);
	isLoadingMore = $state(false);
	isUploading = $state(false);
	uploadProgress = $state('');
	uploadPercent = $state(0);
	uploadAbortController = $state<AbortController | null>(null);
	error = $state<string | null>(null);
	nextStartAfter = $state<string | null>(null);
	selectedKeys = $state<string[]>([]);

	currentBucket = $state('');
	currentPrefix = $state('');

	/** Generation counter so in-flight folder-stat jobs ignore stale results */
	private folderStatsGeneration = 0;
	/** Generation counter so concurrent same-prefix loads ignore stale results */
	private loadGeneration = 0;
	private connection = getConnectionContext();

	async load(bucket: string, prefix = '', startAfter?: string, append = false): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		const prefixChanged = bucket !== this.currentBucket || prefix !== this.currentPrefix;
		this.currentBucket = bucket;
		this.currentPrefix = prefix;
		if (!append && prefixChanged) {
			this.clearSelection();
			// Drop previous listing so navigation never shows the wrong folder
			this.items = [];
			this.commonPrefixes = [];
			this.folderStats = {};
			this.isTruncated = false;
			this.nextStartAfter = null;
			this.folderStatsGeneration += 1;
		}

		const generation = ++this.loadGeneration;

		if (append) {
			this.isLoadingMore = true;
		} else {
			this.isLoading = true;
		}
		this.error = null;

		try {
			const opts: ListObjectsOptions = {
				prefix,
				startAfter,
				delimiter: '/',
				maxKeys: 200
			};
			const result: ObjectListing = await client.listObjects(bucket, opts);

			// Ignore late responses from superseded loads or navigation away
			if (generation !== this.loadGeneration) return;
			if (this.currentBucket !== bucket || this.currentPrefix !== prefix) return;

			this.items = append ? [...this.items, ...result.objects] : result.objects;
			this.commonPrefixes = append
				? [...new Set([...this.commonPrefixes, ...result.commonPrefixes])]
				: result.commonPrefixes;
			this.isTruncated = result.isTruncated;
			this.nextStartAfter = result.nextStartAfter;

			if (!append) {
				if (prefixChanged) {
					// Fresh folder → recompute all folder stats
					this.folderStatsGeneration += 1;
					this.folderStats = {};
					void this.loadFolderStats(bucket, this.commonPrefixes);
				} else {
					// Same-prefix refresh: keep good cached stats, only fetch missing/failed
					const present = new Set(this.commonPrefixes);
					const kept: Record<string, FolderStats> = {};
					for (const [path, stats] of Object.entries(this.folderStats)) {
						if (present.has(path) && !stats.isLoading && !stats.error) {
							kept[path] = stats;
						}
					}
					this.folderStats = kept;
					const missing = this.commonPrefixes.filter((p) => !kept[p]);
					if (missing.length > 0) void this.loadFolderStats(bucket, missing);
				}
			} else if (result.commonPrefixes.length > 0) {
				const missing = result.commonPrefixes.filter((p) => !this.folderStats[p]);
				if (missing.length > 0) void this.loadFolderStats(bucket, missing);
			}
		} catch (err) {
			if (generation !== this.loadGeneration) return;
			if (this.currentBucket !== bucket || this.currentPrefix !== prefix) return;
			this.error = err instanceof Error ? err.message : 'Failed to load objects';
		} finally {
			if (generation === this.loadGeneration) {
				if (append) {
					this.isLoadingMore = false;
				} else {
					this.isLoading = false;
				}
			}
		}
	}

	/** Fetch size / object count / latest modified for each common-prefix folder */
	private async loadFolderStats(bucket: string, prefixes: string[]): Promise<void> {
		const client = this.connection.client;
		if (!client || prefixes.length === 0) return;

		const generation = this.folderStatsGeneration;
		// Only fetch prefixes we don't already have (or that aren't mid-load)
		const pending = prefixes.filter((prefix) => {
			const existing = this.folderStats[prefix];
			return !existing;
		});

		// Mark folders as loading so the UI can show placeholders
		if (pending.length === 0) return;

		const next = { ...this.folderStats };
		for (const prefix of pending) {
			next[prefix] = {
				size: 0,
				objectCount: 0,
				updatedAt: null,
				isPartial: false,
				isLoading: true
			};
		}
		this.folderStats = next;

		let cursor = 0;
		const workers = Array.from(
			{ length: Math.min(FOLDER_STATS_CONCURRENCY, pending.length) },
			async () => {
				while (cursor < pending.length) {
					const index = cursor++;
					const prefix = pending[index];
					if (!prefix) return;
					if (generation !== this.folderStatsGeneration) return;

					try {
						const stats = await this.fetchFolderStats(bucket, prefix);
						if (generation !== this.folderStatsGeneration) return;
						if (this.currentBucket !== bucket) return;
						this.folderStats = { ...this.folderStats, [prefix]: stats };
					} catch {
						if (generation !== this.folderStatsGeneration) return;
						this.folderStats = {
							...this.folderStats,
							[prefix]: {
								size: 0,
								objectCount: 0,
								updatedAt: null,
								isPartial: false,
								isLoading: false,
								error: true
							}
						};
					}
				}
			}
		);

		await Promise.all(workers);
	}

	private async fetchFolderStats(bucket: string, prefix: string): Promise<FolderStats> {
		const client = this.connection.client;
		if (!client) {
			return {
				size: 0,
				objectCount: 0,
				updatedAt: null,
				isPartial: false,
				isLoading: false,
				error: true
			};
		}

		let size = 0;
		let objectCount = 0;
		let updatedAt: string | null = null;
		let startAfter: string | undefined;
		let isPartial = false;

		for (let page = 0; page < FOLDER_STATS_MAX_PAGES; page++) {
			const result = await client.listObjects(bucket, {
				prefix,
				startAfter,
				maxKeys: FOLDER_STATS_PAGE_SIZE
			});

			for (const object of result.objects) {
				size += object.size;
				objectCount += 1;
				if (!updatedAt || object.updatedAt > updatedAt) {
					updatedAt = object.updatedAt;
				}
			}

			if (!result.isTruncated || !result.nextStartAfter) {
				isPartial = false;
				break;
			}

			startAfter = result.nextStartAfter;
			if (page === FOLDER_STATS_MAX_PAGES - 1) {
				isPartial = true;
			}
		}

		return { size, objectCount, updatedAt, isPartial, isLoading: false };
	}

	async remove(key: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			await client.deleteObject(this.currentBucket, key);
			this.items = this.items.filter((o) => o.key !== key);
			this.selectedKeys = this.selectedKeys.filter((selectedKey) => selectedKey !== key);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete object';
			return false;
		}
	}

	async removeMany(keys: string[]): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;
		if (keys.length === 0) return true;

		try {
			await client.deleteObjects(this.currentBucket, keys);
			const keySet = new Set(keys);
			this.items = this.items.filter((object) => !keySet.has(object.key));
			this.clearSelection();
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete selected objects';
			return false;
		}
	}

	async copy(
		sourceKey: string,
		destinationKey: string,
		destinationBucket = this.currentBucket,
		metadataDirective: 'COPY' | 'REPLACE' = 'COPY',
		contentType?: string
	): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			await client.copyObject({
				sourceBucket: this.currentBucket,
				sourceKey,
				destinationBucket,
				destinationKey,
				metadataDirective,
				contentType
			});
			await this.load(this.currentBucket, this.currentPrefix);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to copy object';
			return false;
		}
	}

	/** Download an object via a short-lived signed public URL */
	async download(key: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			const publicUrl = await client.createPublicObjectUrl(this.currentBucket, key);
			this.openDownload(publicUrl.url, key);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to create download URL';
			return false;
		}
	}

	/** Upload files to the current bucket/prefix */
	async upload(files: FileList | File[]): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;
		if (this.isUploading) {
			this.error = 'An upload is already in progress';
			return false;
		}

		const fileArray = Array.from(files);
		if (fileArray.length === 0) return true;

		const totalBytes = fileArray.reduce((sum, file) => sum + file.size, 0);
		let completedBytes = 0;
		let completedFiles = 0;
		let uploadedAny = false;
		const abortController = new AbortController();

		this.isUploading = true;
		this.error = null;
		this.uploadPercent = 0;
		this.uploadAbortController = abortController;

		try {
			for (let i = 0; i < fileArray.length; i++) {
				const file = fileArray[i];
				const key = this.currentPrefix + file.name;
				let currentFileLoaded = 0;
				this.uploadProgress = `Uploading ${i + 1}/${fileArray.length}: ${file.name}`;
				await client.uploadObject(
					{
						bucket: this.currentBucket,
						key,
						body: file,
						contentType: file.type || 'application/octet-stream',
						fileName: file.name
					},
					{
						signal: abortController.signal,
						onProgress: (progress) => {
							currentFileLoaded = Math.min(progress.loadedBytes, file.size);
							this.uploadPercent = aggregateUploadPercent(
								completedBytes + currentFileLoaded,
								totalBytes,
								completedFiles,
								fileArray.length
							);
							this.uploadProgress = describeUploadProgress(progress, i, fileArray.length);
						}
					}
				);
				completedBytes += file.size;
				completedFiles += 1;
				uploadedAny = true;
				this.uploadPercent = aggregateUploadPercent(
					completedBytes,
					totalBytes,
					completedFiles,
					fileArray.length
				);
			}
			await this.load(this.currentBucket, this.currentPrefix);
			return true;
		} catch (err) {
			this.error = isAbortError(err)
				? 'Upload cancelled'
				: err instanceof Error
					? err.message
					: 'Failed to upload file(s)';
			if (uploadedAny) {
				await this.load(this.currentBucket, this.currentPrefix);
			}
			return false;
		} finally {
			this.isUploading = false;
			this.uploadProgress = '';
			this.uploadPercent = 0;
			this.uploadAbortController = null;
		}
	}

	cancelUpload(): void {
		this.uploadAbortController?.abort();
	}

	/** Get object metadata via HEAD */
	async getMetadata(key: string): Promise<ObjectMetadata | null> {
		const client = this.connection.client;
		if (!client) return null;

		try {
			return await client.headObject(this.currentBucket, key);
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load metadata';
			return null;
		}
	}

	toggleSelected(key: string): void {
		this.selectedKeys = this.selectedKeys.includes(key)
			? this.selectedKeys.filter((selectedKey) => selectedKey !== key)
			: [...this.selectedKeys, key];
	}

	clearSelection(): void {
		this.selectedKeys = [];
	}

	/** Replace selection with the given keys (e.g. currently filtered/visible rows). */
	selectKeys(keys: string[]): void {
		this.selectedKeys = [...keys];
	}

	/** Remove the given keys from the current selection. */
	deselectKeys(keys: string[]): void {
		const remove = new Set(keys);
		this.selectedKeys = this.selectedKeys.filter((key) => !remove.has(key));
	}

	/** True when every key is selected (and keys is non-empty). */
	areAllSelected(keys: string[]): boolean {
		return keys.length > 0 && keys.every((key) => this.selectedKeys.includes(key));
	}

	selectVisible(): void {
		this.selectedKeys = this.items.map((object) => object.key);
	}

	private openDownload(url: string, key: string): void {
		const a = document.createElement('a');
		a.href = url;
		a.download = key.split('/').pop() ?? key;
		a.target = '_blank';
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	/** Navigate into a folder (prefix). No-ops if already there. */
	navigateToPrefix(prefix: string): void {
		if (!this.currentBucket) return;
		if (prefix === this.currentPrefix) return;
		void this.load(this.currentBucket, prefix);
	}

	loadMore(): void {
		if (!this.nextStartAfter || this.isLoadingMore) return;
		this.load(this.currentBucket, this.currentPrefix, this.nextStartAfter, true);
	}

	/** Navigate up one directory level */
	navigateUp(): void {
		const parts = this.currentPrefix.split('/').filter(Boolean);
		parts.pop();
		const newPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
		this.load(this.currentBucket, newPrefix);
	}

	/** Build breadcrumb segments from the current prefix */
	get breadcrumbs(): Array<{ label: string; prefix: string }> {
		const parts = this.currentPrefix.split('/').filter(Boolean);
		const crumbs: Array<{ label: string; prefix: string }> = [
			{ label: this.currentBucket, prefix: '' }
		];

		let accumulated = '';
		for (const part of parts) {
			accumulated += part + '/';
			crumbs.push({ label: part, prefix: accumulated });
		}

		return crumbs;
	}

	get isEmpty(): boolean {
		return this.items.length === 0 && this.commonPrefixes.length === 0;
	}

	get totalItems(): number {
		return this.items.length + this.commonPrefixes.length;
	}

	get allVisibleSelected(): boolean {
		return this.areAllSelected(this.items.map((object) => object.key));
	}
}

function aggregateUploadPercent(
	loadedBytes: number,
	totalBytes: number,
	completedFiles: number,
	totalFiles: number
): number {
	if (totalBytes > 0) {
		return Math.min(100, Math.max(0, (loadedBytes / totalBytes) * 100));
	}
	return totalFiles === 0 ? 100 : Math.min(100, (completedFiles / totalFiles) * 100);
}

function describeUploadProgress(
	progress: UploadProgress,
	fileIndex: number,
	totalFiles: number
): string {
	const filePosition = `${fileIndex + 1}/${totalFiles}`;
	if (progress.phase === 'initiating') {
		return `Starting ${filePosition}: ${progress.fileName}`;
	}
	if (progress.phase === 'uploading_parts' && progress.partNumber && progress.partCount) {
		return `Uploading ${filePosition}: ${progress.fileName} (part ${progress.partNumber}/${progress.partCount})`;
	}
	if (progress.phase === 'completing') {
		return `Completing ${filePosition}: ${progress.fileName}`;
	}
	if (progress.phase === 'aborting') {
		return `Cancelling ${filePosition}: ${progress.fileName}`;
	}
	return `Uploading ${filePosition}: ${progress.fileName}`;
}

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === 'AbortError';
}

const [internalGetObjects, setInternalObjects] = createContext<ObjectsStore>();

export function getObjectsContext(): ObjectsStore {
	const ctx = internalGetObjects();
	if (!ctx) throw new Error('ObjectsStore not found — ensure setObjectsContext() was called');
	return ctx;
}

export function setObjectsContext(): ObjectsStore {
	const store = new ObjectsStore();
	setInternalObjects(store);
	return store;
}
