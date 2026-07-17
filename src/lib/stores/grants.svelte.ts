import { createContext } from 'svelte';
import type {
	BucketGrant,
	CreateBucketGrantRequest,
	UpdateBucketGrantRequest
} from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';
import { getBucketsContext } from './buckets.svelte';

class GrantsStore {
	items = $state<BucketGrant[]>([]);
	myGrants = $state<BucketGrant[]>([]);
	isLoading = $state(false);
	error = $state<string | null>(null);

	private connection = getConnectionContext();

	async load(bucket: string): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.isLoading = true;
		this.error = null;

		try {
			this.items = await client.listBucketGrants(bucket);
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load grants';
		} finally {
			this.isLoading = false;
		}
	}

	async loadMyGrants(): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.isLoading = true;
		this.error = null;

		try {
			this.myGrants = await client.listMyGrants();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load my grants';
		} finally {
			this.isLoading = false;
		}
	}

	async create(bucket: string, req: CreateBucketGrantRequest): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		this.error = null;
		try {
			const created = await client.createBucketGrants(bucket, req);
			this.items.push(...created);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to create grants';
			return false;
		}
	}

	async update(bucket: string, id: string, req: UpdateBucketGrantRequest): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		this.error = null;
		try {
			const updated = await client.updateBucketGrant(bucket, id, req);
			this.items = this.items.map((item) => (item.id === id ? updated : item));
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to update grant';
			return false;
		}
	}

	async remove(bucket: string, id: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		this.error = null;
		try {
			await client.deleteBucketGrant(bucket, id);
			this.items = this.items.filter((item) => item.id !== id);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete grant';
			return false;
		}
	}

	async transferOwnership(bucket: string, newOwnerUserId: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		const buckets = getBucketsContext();
		this.error = null;
		try {
			const updatedBucket = await client.transferBucketOwnership(bucket, newOwnerUserId);
			if (buckets.selected?.name === bucket) {
				buckets.selected = updatedBucket;
			}
			buckets.items = buckets.items.map((b) => (b.name === bucket ? updatedBucket : b));
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to transfer bucket ownership';
			return false;
		}
	}
}

const [internalGetGrants, setInternalGrants] = createContext<GrantsStore>();

export function getGrantsContext(): GrantsStore {
	const ctx = internalGetGrants();
	if (!ctx) throw new Error('GrantsStore not found — ensure setGrantsContext() was called');
	return ctx;
}

export function setGrantsContext(): GrantsStore {
	const store = new GrantsStore();
	setInternalGrants(store);
	return store;
}
