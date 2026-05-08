import { createContext } from 'svelte';
import type { ListObjectsOptions, ObjectListing, StorageObject } from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

class ObjectsStore {
	items = $state<StorageObject[]>([]);
	commonPrefixes = $state<string[]>([]);
	isTruncated = $state(false);
	isLoading = $state(false);
	isLoadingMore = $state(false);
	error = $state<string | null>(null);
	nextStartAfter = $state<string | null>(null);

	currentBucket = $state('');
	currentPrefix = $state('');

	private connection = getConnectionContext();

	async load(bucket: string, prefix = '', startAfter?: string, append = false): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.currentBucket = bucket;
		this.currentPrefix = prefix;
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
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete object';
			return false;
		}
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
