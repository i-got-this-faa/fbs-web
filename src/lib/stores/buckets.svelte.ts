import { createContext } from 'svelte';
import type { Bucket } from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

/**
 * Buckets store.
 */
class BucketsStore {
	items = $state<Bucket[]>([]);
	selected = $state<Bucket | null>(null);
	isLoading = $state(false);
	error = $state<string | null>(null);

	private connection = getConnectionContext();

	async load(): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.isLoading = true;
		this.error = null;

		try {
			this.items = await client.listBuckets();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load buckets';
		} finally {
			this.isLoading = false;
		}
	}

	async loadOne(name: string): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.error = null;

		try {
			this.selected = await client.getBucket(name);
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load bucket';
		}
	}

	async create(name: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			await client.createBucket(name);
			await this.load();
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to create bucket';
			return false;
		}
	}

	async remove(name: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			await client.deleteBucket(name);
			this.items = this.items.filter((bucket) => bucket.name !== name);
			if (this.selected?.name === name) this.selected = null;
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete bucket';
			return false;
		}
	}

	async empty(name: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			await client.emptyBucket(name);
			await this.loadOne(name);
			this.items = this.items.map((bucket) =>
				bucket.name === name ? { ...bucket, objectCount: 0, totalObjectBytes: 0 } : bucket
			);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to empty bucket';
			return false;
		}
	}

	async deleteEmptyS3(name: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			await client.deleteEmptyBucketS3(name);
			this.items = this.items.filter((bucket) => bucket.name !== name);
			if (this.selected?.name === name) this.selected = null;
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete empty bucket';
			return false;
		}
	}

	get count(): number {
		return this.items.length;
	}
}

const [internalGetBuckets, setInternalBuckets] = createContext<BucketsStore>();

export function getBucketsContext(): BucketsStore {
	const ctx = internalGetBuckets();
	if (!ctx) throw new Error('BucketsStore not found — ensure setBucketsContext() was called');
	return ctx;
}

export function setBucketsContext(): BucketsStore {
	const store = new BucketsStore();
	setInternalBuckets(store);
	return store;
}
