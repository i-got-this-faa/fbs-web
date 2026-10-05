import { createContext } from 'svelte';
import type { CreateShareLinkRequest, ShareLink } from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

class ShareLinksStore {
	items = $state<ShareLink[]>([]);
	isLoading = $state(false);
	error = $state<string | null>(null);
	private connection = getConnectionContext();
	private generation = 0;
	private bucket = '';

	async load(bucket: string): Promise<void> {
		const client = this.connection.client;
		if (!client) return;
		const generation = ++this.generation;
		if (this.bucket !== bucket) this.items = [];
		this.bucket = bucket;
		this.isLoading = true;
		this.error = null;
		try {
			const items = await client.listShareLinks(bucket);
			if (generation === this.generation && client === this.connection.client) this.items = items;
		} catch (err) {
			if (generation === this.generation)
				this.error = err instanceof Error ? err.message : 'Failed to load share links';
		} finally {
			if (generation === this.generation) this.isLoading = false;
		}
	}

	async create(req: CreateShareLinkRequest): Promise<ShareLink> {
		const client = this.connection.client;
		if (!client) throw new Error('Not connected');
		const link = await client.createShareLink(req);
		if (this.bucket === link.bucket && client === this.connection.client) {
			await this.load(link.bucket);
		}
		return link;
	}

	async remove(code: string): Promise<void> {
		const client = this.connection.client;
		if (!client) throw new Error('Not connected');
		const bucket = this.bucket;
		await client.deleteShareLink(code);
		if (this.bucket === bucket && client === this.connection.client) await this.load(bucket);
	}
}

const [getShareLinksContext, setContext] = createContext<ShareLinksStore>();
export { getShareLinksContext };
export function setShareLinksContext(): ShareLinksStore {
	const store = new ShareLinksStore();
	setContext(store);
	return store;
}
