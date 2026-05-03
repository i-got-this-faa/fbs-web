import { createContext } from 'svelte';
import type { Bucket } from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

class BucketsStore {
	items = $state<Bucket[]>([]);
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
			this.items = this.items.filter((b) => b.name !== name);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete bucket';
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
