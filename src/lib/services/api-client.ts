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
import { parseListObjectsV2, parseS3ErrorMessage } from '$lib/utils/s3-xml';

/**
 * S3-compatible API client.
 *
 * Talks directly to the fbs-core S3 endpoints that exist today.
 * Management API endpoints (keys, metrics, bucket listing) are stubbed
 * and will be wired up once the management layer is built.
 */
export class FbsApiClient implements FbsClient {
	constructor(
		private baseUrl: string,
		private token: string
	) {}

	private get authHeaders(): HeadersInit {
		if (this.token) {
			return { Authorization: `Bearer ${this.token}` };
		}
		return {};
	}

	private async s3Fetch(path: string, init?: RequestInit): Promise<Response> {
		const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
		return fetch(url, {
			...init,
			headers: {
				...this.authHeaders,
				...(init?.headers ?? {})
			}
		});
	}

	/** Throw a user-friendly error from an S3 XML error response */
	private async throwS3Error(res: Response, fallback: string): Promise<never> {
		const text = await res.text().catch(() => '');
		const msg = parseS3ErrorMessage(text) || `${fallback} (HTTP ${res.status})`;
		throw new Error(msg);
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

	// ── Buckets (S3) ──────────────────────────────────────────────────────

	/** S3 CreateBucket: PUT /{bucket} */
	async createBucket(name: string): Promise<Bucket> {
		const res = await this.s3Fetch(`/${encodeURIComponent(name)}`, { method: 'PUT' });

		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to create bucket');
		}

		return { name, ownerId: '', createdAt: new Date().toISOString() };
	}

	/**
	 * Check if a bucket exists by issuing a zero-key ListObjectsV2 call.
	 * Returns true if the bucket exists, false if it 404s.
	 */
	async bucketExists(name: string): Promise<boolean> {
		try {
			const res = await this.s3Fetch(`/${encodeURIComponent(name)}?list-type=2&max-keys=0`);
			return res.ok;
		} catch {
			return false;
		}
	}

	/** Not yet implemented — requires Management API */
	async listBuckets(): Promise<Bucket[]> {
		throw new Error('Management API not yet available');
	}

	/** Not yet implemented — requires Management API */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async deleteBucket(name: string): Promise<void> {
		throw new Error('Management API not yet available');
	}

	// ── Objects (S3) ──────────────────────────────────────────────────────

	/** S3 ListObjectsV2: GET /{bucket}?list-type=2 */
	async listObjects(bucket: string, opts?: ListObjectsOptions): Promise<ObjectListing> {
		const params = new URLSearchParams({ 'list-type': '2' });
		if (opts?.prefix) params.set('prefix', opts.prefix);
		if (opts?.startAfter) params.set('start-after', opts.startAfter);
		if (opts?.maxKeys) params.set('max-keys', String(opts.maxKeys));
		if (opts?.delimiter) params.set('delimiter', opts.delimiter);

		const res = await this.s3Fetch(`/${encodeURIComponent(bucket)}?${params}`);

		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to list objects');
		}

		const xml = await res.text();
		return parseListObjectsV2(xml);
	}

	/** S3 DeleteObject: DELETE /{bucket}/{key} */
	async deleteObject(bucket: string, key: string): Promise<void> {
		const res = await this.s3Fetch(`/${encodeURIComponent(bucket)}/${encodeURI(key)}`, {
			method: 'DELETE'
		});

		if (!res.ok && res.status !== 204) {
			await this.throwS3Error(res, 'Failed to delete object');
		}
	}

	// ── Keys (Management API — placeholder) ───────────────────────────────
	async listKeys(): Promise<AccessKey[]> {
		throw new Error('Management API not yet available');
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async createKey(data: CreateKeyRequest): Promise<CreateKeyResponse> {
		throw new Error('Management API not yet available');
	}

	async updateKey(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		id: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		data: Partial<Pick<AccessKey, 'displayName' | 'isActive'>>
	): Promise<AccessKey> {
		throw new Error('Management API not yet available');
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async deleteKey(id: string): Promise<void> {
		throw new Error('Management API not yet available');
	}

	// ── Metrics (Management API — placeholder) ────────────────────────────
	async getMetrics(): Promise<DashboardMetrics> {
		throw new Error('Management API not yet available');
	}
}
