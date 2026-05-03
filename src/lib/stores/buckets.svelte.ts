import { createContext } from 'svelte';
import type { Bucket } from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';
import { FbsApiClient } from '$lib/services/api-client';

const KNOWN_BUCKETS_KEY = 'fbs_known_buckets';

/**
 * Buckets store.
 *
 * Since there's no ListBuckets endpoint yet (management API coming soon),
 * we maintain a local registry of known bucket names in localStorage.
 * Buckets get added when the user creates one or manually adds one by name.
 * We validate each by checking if it exists on the server.
 */
class BucketsStore {
	items = $state<Bucket[]>([]);
	isLoading = $state(false);
	error = $state<string | null>(null);

	private connection = getConnectionContext();

	/** Load known buckets from localStorage and validate them against the server */
	async load(): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.isLoading = true;
		this.error = null;

		try {
			const knownNames = this.loadKnownNames();

			if (knownNames.length === 0) {
				this.items = [];
				return;
			}

			// Validate each known bucket exists (only for real API client)
			if (client instanceof FbsApiClient) {
				const validated: Bucket[] = [];
				const stillValid: string[] = [];

				for (const name of knownNames) {
					const exists = await client.bucketExists(name);
					if (exists) {
						validated.push({
							name,
							ownerId: '',
							createdAt: ''
						});
						stillValid.push(name);
					}
				}

				// Clean up stale entries
				this.saveKnownNames(stillValid);
				this.items = validated;
			} else {
				// Mock client — use its listBuckets
				this.items = await client.listBuckets();
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load buckets';
		} finally {
			this.isLoading = false;
		}
	}

	/** Create a new bucket via S3 API and track it locally */
	async create(name: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			const bucket = await client.createBucket(name);
			this.addKnownName(name);
			this.items = [...this.items, bucket];
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to create bucket';
			return false;
		}
	}

	/** Add an existing bucket by name (user manually enters it) */
	async addExisting(name: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		if (this.items.some((b) => b.name === name)) {
			this.error = `"${name}" is already in your list`;
			return false;
		}

		try {
			if (client instanceof FbsApiClient) {
				const exists = await client.bucketExists(name);
				if (!exists) {
					this.error = `Bucket "${name}" does not exist on the server`;
					return false;
				}
			}

			this.addKnownName(name);
			this.items = [...this.items, { name, ownerId: '', createdAt: '' }];
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to verify bucket';
			return false;
		}
	}

	/** Remove a bucket from the local list (does NOT delete it from the server) */
	removeFromList(name: string): void {
		this.items = this.items.filter((b) => b.name !== name);
		const names = this.loadKnownNames().filter((n) => n !== name);
		this.saveKnownNames(names);
	}

	/** Delete a bucket from the server — requires Management API */
	async remove(name: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			await client.deleteBucket(name);
			this.removeFromList(name);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete bucket';
			return false;
		}
	}

	get count(): number {
		return this.items.length;
	}

	// ── LocalStorage helpers ──────────────────────────────────────────────

	private loadKnownNames(): string[] {
		if (typeof window === 'undefined') return [];
		try {
			const raw = localStorage.getItem(KNOWN_BUCKETS_KEY);
			return raw ? (JSON.parse(raw) as string[]) : [];
		} catch {
			return [];
		}
	}

	private saveKnownNames(names: string[]): void {
		if (typeof window === 'undefined') return;
		localStorage.setItem(KNOWN_BUCKETS_KEY, JSON.stringify(names));
	}

	private addKnownName(name: string): void {
		const names = this.loadKnownNames();
		if (!names.includes(name)) {
			names.push(name);
			this.saveKnownNames(names);
		}
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
