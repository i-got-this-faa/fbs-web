import { createContext } from 'svelte';
import type {
	ListObjectsOptions,
	ObjectListing,
	ObjectMetadata,
	StorageObject
} from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

class ObjectsStore {
	items = $state<StorageObject[]>([]);
	commonPrefixes = $state<string[]>([]);
	isTruncated = $state(false);
	isLoading = $state(false);
	isLoadingMore = $state(false);
	isUploading = $state(false);
	uploadProgress = $state('');
	error = $state<string | null>(null);
	nextStartAfter = $state<string | null>(null);
	selectedKeys = $state<string[]>([]);

	currentBucket = $state('');
	currentPrefix = $state('');

	private connection = getConnectionContext();

	async load(bucket: string, prefix = '', startAfter?: string, append = false): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		const prefixChanged = bucket !== this.currentBucket || prefix !== this.currentPrefix;
		this.currentBucket = bucket;
		this.currentPrefix = prefix;
		if (!append && prefixChanged) {
			this.clearSelection();
		}
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

			this.items = append ? [...this.items, ...result.objects] : result.objects;
			this.commonPrefixes = append
				? [...new Set([...this.commonPrefixes, ...result.commonPrefixes])]
				: result.commonPrefixes;
			this.isTruncated = result.isTruncated;
			this.nextStartAfter = result.nextStartAfter;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load objects';
		} finally {
			if (append) {
				this.isLoadingMore = false;
			} else {
				this.isLoading = false;
			}
		}
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

		this.isUploading = true;
		this.error = null;

		try {
			const fileArray = Array.from(files);
			for (let i = 0; i < fileArray.length; i++) {
				const file = fileArray[i];
				const key = this.currentPrefix + file.name;
				this.uploadProgress = `Uploading ${i + 1}/${fileArray.length}: ${file.name}`;
				await client.uploadObject({
					bucket: this.currentBucket,
					key,
					body: file,
					contentType: file.type || 'application/octet-stream'
				});
			}
			await this.load(this.currentBucket, this.currentPrefix);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to upload file(s)';
			return false;
		} finally {
			this.isUploading = false;
			this.uploadProgress = '';
		}
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

	/** Navigate into a folder (prefix) */
	navigateToPrefix(prefix: string): void {
		this.load(this.currentBucket, prefix);
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
		return (
			this.items.length > 0 && this.items.every((object) => this.selectedKeys.includes(object.key))
		);
	}
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
