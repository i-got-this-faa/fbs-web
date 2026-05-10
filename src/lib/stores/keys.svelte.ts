import { createContext } from 'svelte';
import type {
	AccessKey,
	CreateKeyRequest,
	CreateKeyResponse,
	UpdateKeyRequest
} from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

class KeysStore {
	items = $state<AccessKey[]>([]);
	isLoading = $state(false);
	error = $state<string | null>(null);

	/** Holds the one-time secret after creating a key */
	lastCreatedSecret = $state<CreateKeyResponse | null>(null);

	private connection = getConnectionContext();

	async load(): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.isLoading = true;
		this.error = null;

		try {
			this.items = await client.listKeys();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load access keys';
		} finally {
			this.isLoading = false;
		}
	}

	async create(data: CreateKeyRequest): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			const result = await client.createKey(data);
			this.lastCreatedSecret = result;
			await this.load();
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to create key';
			return false;
		}
	}

	async toggleActive(id: string, isActive: boolean): Promise<boolean> {
		return this.update(id, { isActive });
	}

	async rename(id: string, displayName: string): Promise<boolean> {
		return this.update(id, { displayName });
	}

	async update(id: string, data: UpdateKeyRequest): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			const updated = await client.updateKey(id, data);
			this.items = this.items.map((key) => (key.id === id ? updated : key));
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to update key';
			return false;
		}
	}

	async remove(id: string): Promise<boolean> {
		const client = this.connection.client;
		if (!client) return false;

		try {
			await client.deleteKey(id);
			this.items = this.items.filter((k) => k.id !== id);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete key';
			return false;
		}
	}

	dismissSecret(): void {
		this.lastCreatedSecret = null;
	}

	get activeCount(): number {
		return this.items.filter((k) => k.isActive).length;
	}
}

const [internalGetKeys, setInternalKeys] = createContext<KeysStore>();

export function getKeysContext(): KeysStore {
	const ctx = internalGetKeys();
	if (!ctx) throw new Error('KeysStore not found — ensure setKeysContext() was called');
	return ctx;
}

export function setKeysContext(): KeysStore {
	const store = new KeysStore();
	setInternalKeys(store);
	return store;
}
