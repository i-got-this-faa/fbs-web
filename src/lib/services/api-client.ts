import type {
	AccessKey,
	Bucket,
	CreateKeyRequest,
	CreateKeyResponse,
	DashboardMetrics,
	FbsClient,
	ListObjectsOptions,
	ObjectListing
} from '$lib/types/api';

export class FbsApiClient implements FbsClient {
	constructor(
		private baseUrl: string,
		private token: string
	) {}

	private get headers(): HeadersInit {
		return {
			Authorization: `Bearer ${this.token}`,
			'Content-Type': 'application/json'
		};
	}

	private async request<T>(path: string, init?: RequestInit): Promise<T> {
		const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
		const response = await fetch(url, {
			...init,
			headers: {
				...this.headers,
				...(init?.headers ?? {})
			}
		});

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`API ${response.status}: ${body || response.statusText}`);
		}

		// DELETE / no-content responses
		if (response.status === 204 || response.headers.get('content-length') === '0') {
			return undefined as T;
		}

		return response.json() as Promise<T>;
	}

	// ── Health ─────────────────────────────────────────────────────────────
	async healthCheck(): Promise<boolean> {
		try {
			const url = `${this.baseUrl.replace(/\/$/, '')}/healthz`;
			const res = await fetch(url, { method: 'GET' });
			return res.ok;
		} catch {
			return false;
		}
	}

	// ── Buckets ────────────────────────────────────────────────────────────
	async listBuckets(): Promise<Bucket[]> {
		return this.request<Bucket[]>('/api/v1/buckets');
	}

	async createBucket(name: string): Promise<Bucket> {
		return this.request<Bucket>('/api/v1/buckets', {
			method: 'POST',
			body: JSON.stringify({ name })
		});
	}

	async deleteBucket(name: string): Promise<void> {
		return this.request<void>(`/api/v1/buckets/${encodeURIComponent(name)}`, {
			method: 'DELETE'
		});
	}

	// ── Objects ────────────────────────────────────────────────────────────
	async listObjects(bucket: string, opts?: ListObjectsOptions): Promise<ObjectListing> {
		const params = new URLSearchParams();
		if (opts?.prefix) params.set('prefix', opts.prefix);
		if (opts?.startAfter) params.set('start-after', opts.startAfter);
		if (opts?.maxKeys) params.set('max-keys', String(opts.maxKeys));
		if (opts?.delimiter) params.set('delimiter', opts.delimiter);

		const query = params.toString();
		const path = `/api/v1/buckets/${encodeURIComponent(bucket)}/objects${query ? `?${query}` : ''}`;
		return this.request<ObjectListing>(path);
	}

	async deleteObject(bucket: string, key: string): Promise<void> {
		return this.request<void>(
			`/api/v1/buckets/${encodeURIComponent(bucket)}/objects/${encodeURIComponent(key)}`,
			{ method: 'DELETE' }
		);
	}

	// ── Keys ──────────────────────────────────────────────────────────────
	async listKeys(): Promise<AccessKey[]> {
		return this.request<AccessKey[]>('/api/v1/keys');
	}

	async createKey(data: CreateKeyRequest): Promise<CreateKeyResponse> {
		return this.request<CreateKeyResponse>('/api/v1/keys', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	async updateKey(
		id: string,
		data: Partial<Pick<AccessKey, 'displayName' | 'isActive'>>
	): Promise<AccessKey> {
		return this.request<AccessKey>(`/api/v1/keys/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	async deleteKey(id: string): Promise<void> {
		return this.request<void>(`/api/v1/keys/${encodeURIComponent(id)}`, {
			method: 'DELETE'
		});
	}

	// ── Metrics ───────────────────────────────────────────────────────────
	async getMetrics(): Promise<DashboardMetrics> {
		return this.request<DashboardMetrics>('/api/v1/metrics');
	}
}
