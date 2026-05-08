import { createContext } from 'svelte';
import type { DashboardMetrics } from '$lib/types/api';
import { getConnectionContext } from './connection.svelte';

class DashboardStore {
	metrics = $state<DashboardMetrics | null>(null);
	isLoading = $state(false);
	error = $state<string | null>(null);

	private connection = getConnectionContext();

	async load(): Promise<void> {
		const client = this.connection.client;
		if (!client) return;

		this.isLoading = true;
		this.error = null;

		try {
			this.metrics = await client.getMetrics();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load dashboard metrics';
		} finally {
			this.isLoading = false;
		}
	}
}

const [internalGetDashboard, setInternalDashboard] = createContext<DashboardStore>();

export function getDashboardContext(): DashboardStore {
	const ctx = internalGetDashboard();
	if (!ctx) throw new Error('DashboardStore not found — ensure setDashboardContext() was called');
	return ctx;
}

export function setDashboardContext(): DashboardStore {
	const store = new DashboardStore();
	setInternalDashboard(store);
	return store;
}
