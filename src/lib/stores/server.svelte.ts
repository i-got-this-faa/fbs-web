import { createContext } from 'svelte';
import type { ActivityItem, ListActivityOptions, ServerConfig } from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

class ServerStore {
	config = $state<ServerConfig | null>(null);
	activity = $state<ActivityItem[]>([]);
	isLoadingConfig = $state(false);
	isLoadingActivity = $state(false);
	error = $state<string | null>(null);

	private connection = getConnectionContext();

	async loadConfig(): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.isLoadingConfig = true;
		this.error = null;

		try {
			this.config = await client.getConfig();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load server config';
		} finally {
			this.isLoadingConfig = false;
		}
	}

	async loadActivity(opts?: ListActivityOptions): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.isLoadingActivity = true;
		this.error = null;

		try {
			this.activity = await client.listActivity(opts);
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load activity';
		} finally {
			this.isLoadingActivity = false;
		}
	}

	async refresh(): Promise<void> {
		await Promise.all([this.loadConfig(), this.loadActivity()]);
	}
}

const [internalGetServer, setInternalServer] = createContext<ServerStore>();

export function getServerContext(): ServerStore {
	const ctx = internalGetServer();
	if (!ctx) throw new Error('ServerStore not found — ensure setServerContext() was called');
	return ctx;
}

export function setServerContext(): ServerStore {
	const store = new ServerStore();
	setInternalServer(store);
	return store;
}
