import { createContext } from 'svelte';
import { FbsApiClient } from '$lib/services/api-client';
import { MockFbsClient } from '$lib/services/mock-client';
import type { FbsClient } from '$lib/types/api';

const STORAGE_KEY = 'fbs_connection';

interface SavedConnection {
	apiUrl: string;
	token: string;
}

class ConnectionStore {
	apiUrl = $state('');
	token = $state('');
	isConnected = $state(false);
	isConnecting = $state(false);
	error = $state<string | null>(null);
	useMock = $state(false);

	private _client = $state<FbsClient | null>(null);

	get client(): FbsClient | null {
		return this._client;
	}

	constructor() {
		// Try to restore from localStorage on construction
		if (typeof window !== 'undefined') {
			this.restore();
		}
	}

	/** Attempt connection to the backend, persist on success */
	async connect(apiUrl: string, token: string): Promise<void> {
		this.isConnecting = true;
		this.error = null;

		try {
			const trimmedUrl = apiUrl.replace(/\/+$/, '');
			const client = new FbsApiClient(trimmedUrl, token);
			const healthy = await client.healthCheck();

			if (!healthy) {
				throw new Error('Backend health check failed — server may be down or URL is incorrect.');
			}

			this.apiUrl = trimmedUrl;
			this.token = token;
			this._client = client;
			this.isConnected = true;
			this.useMock = false;
			this.save();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Connection failed';
			this.isConnected = false;
			this._client = null;
		} finally {
			this.isConnecting = false;
		}
	}

	/** Use mock client for development */
	connectMock(): void {
		this._client = new MockFbsClient();
		this.isConnected = true;
		this.useMock = true;
		this.apiUrl = 'mock://localhost';
		this.token = 'mock-token';
		this.error = null;
	}

	/** Disconnect and clear saved credentials */
	disconnect(): void {
		this._client = null;
		this.isConnected = false;
		this.apiUrl = '';
		this.token = '';
		this.error = null;
		this.useMock = false;

		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	/** Save connection to localStorage */
	private save(): void {
		if (typeof window === 'undefined' || this.useMock) return;

		const data: SavedConnection = {
			apiUrl: this.apiUrl,
			token: this.token
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	}

	/** Restore connection from localStorage */
	private restore(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;

			const data = JSON.parse(raw) as SavedConnection;
			if (data.apiUrl) {
				this.apiUrl = data.apiUrl;
				this.token = data.token;
				// Re-connect silently in the background
				this.connect(data.apiUrl, data.token);
			}
		} catch {
			localStorage.removeItem(STORAGE_KEY);
		}
	}
}

const [internalGetConnection, setInternalConnection] = createContext<ConnectionStore>();

export function getConnectionContext(): ConnectionStore {
	const ctx = internalGetConnection();
	if (!ctx) throw new Error('ConnectionStore not found — wrap with ConnectionWrapper');
	return ctx;
}

export function setConnectionContext(): ConnectionStore {
	const store = new ConnectionStore();
	setInternalConnection(store);
	return store;
}
