import type {
	AccessKey,
	Bucket,
	CreateKeyRequest,
	CreateKeyResponse,
	DashboardMetrics,
	FbsClient,
	ListObjectsOptions,
	ObjectListing,
	StorageObject
} from '$lib/types/api';
import { parseS3ErrorMessage } from '$lib/utils/s3-xml';

/**
 * fbs-core API client.
 *
 * Uses the Management API for admin dashboard reads and key management,
 * while keeping S3-compatible endpoints for bucket creation and object deletion.
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

	private async managementFetch(path: string, init?: RequestInit): Promise<Response> {
		return this.s3Fetch(`/api/management${path}`, {
			...init,
			headers: {
				Accept: 'application/json',
				...(init?.body ? { 'Content-Type': 'application/json' } : {}),
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

	private async throwManagementError(res: Response, fallback: string): Promise<never> {
		const message = await readManagementErrorMessage(res);
		throw new Error(message || `${fallback} (HTTP ${res.status})`);
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

		return {
			name,
			ownerId: '',
			createdAt: new Date().toISOString(),
			objectCount: 0,
			totalObjectBytes: 0
		};
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

	async listBuckets(): Promise<Bucket[]> {
		const res = await this.managementFetch('/buckets');
		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to list buckets');
		}

		const body = (await res.json()) as ManagementBucketsResponse;
		return body.buckets.map(mapBucket);
	}

	async deleteBucket(name: string): Promise<void> {
		const res = await this.managementFetch(`/buckets/${encodeURIComponent(name)}`, {
			method: 'DELETE'
		});

		if (!res.ok && res.status !== 204) {
			await this.throwManagementError(res, 'Failed to delete bucket');
		}
	}

	// ── Objects ──────────────────────────────────────────────────────────

	/** Management object list with prefix/delimiter cursor semantics */
	async listObjects(bucket: string, opts?: ListObjectsOptions): Promise<ObjectListing> {
		const params = new URLSearchParams();
		if (opts?.prefix) params.set('prefix', opts.prefix);
		if (opts?.startAfter) params.set('cursor', opts.startAfter);
		if (opts?.maxKeys) params.set('limit', String(opts.maxKeys));
		if (opts?.delimiter) params.set('delimiter', opts.delimiter);

		const query = params.toString();
		const res = await this.managementFetch(
			`/buckets/${encodeURIComponent(bucket)}/objects${query ? `?${query}` : ''}`
		);

		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to list objects');
		}

		const body = (await res.json()) as ManagementObjectsResponse;
		return {
			objects: body.objects.map((object) => mapObject(body.bucket, object)),
			commonPrefixes: body.common_prefixes,
			isTruncated: body.is_truncated,
			nextStartAfter: body.next_cursor || null
		};
	}

	/** S3 DeleteObject: DELETE /{bucket}/{key} */
	async deleteObject(bucket: string, key: string): Promise<void> {
		const res = await this.s3Fetch(`/${encodeURIComponent(bucket)}/${encodeObjectKeyPath(key)}`, {
			method: 'DELETE'
		});

		if (!res.ok && res.status !== 204) {
			await this.throwS3Error(res, 'Failed to delete object');
		}
	}

	// ── Keys (Management API) ────────────────────────────────────────────
	async listKeys(): Promise<AccessKey[]> {
		const res = await this.managementFetch('/keys');
		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to list keys');
		}

		const body = (await res.json()) as ManagementKeysResponse;
		return body.keys.map(mapKey);
	}

	async createKey(data: CreateKeyRequest): Promise<CreateKeyResponse> {
		const res = await this.managementFetch('/keys', {
			method: 'POST',
			body: JSON.stringify({
				display_name: data.displayName,
				role: data.role
			})
		});
		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to create key');
		}

		const body = (await res.json()) as ManagementCreateKeyResponse;
		return {
			key: mapKey(body.key),
			bearerToken: body.bearer_token,
			sigV4: {
				accessKeyId: body.sigv4.access_key_id,
				secretKey: body.sigv4.secret_key
			}
		};
	}

	async updateKey(
		id: string,
		data: Partial<Pick<AccessKey, 'displayName' | 'isActive'>>
	): Promise<AccessKey> {
		throw new Error(
			`Key updates are not supported by this fbs-core management API (${id}, ${Object.keys(data).join(', ')})`
		);
	}

	async deleteKey(id: string): Promise<void> {
		const res = await this.managementFetch(`/keys/${encodeURIComponent(id)}`, {
			method: 'DELETE'
		});

		if (!res.ok && res.status !== 204) {
			await this.throwManagementError(res, 'Failed to delete key');
		}
	}

	// ── Metrics (Management API) ─────────────────────────────────────────
	async getMetrics(): Promise<DashboardMetrics> {
		const res = await this.managementFetch('/metrics');
		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to load metrics');
		}

		const body = (await res.json()) as ManagementMetricsResponse;
		return {
			totalBuckets: body.bucket_count,
			totalObjects: body.object_count,
			totalStorageBytes: body.total_object_bytes,
			totalKeys: body.user_count,
			activeKeys: body.active_user_count,
			recentUploads: []
		};
	}
}

interface ManagementErrorResponse {
	error?: {
		message?: string;
	};
}

interface ManagementMetricsResponse {
	bucket_count: number;
	object_count: number;
	total_object_bytes: number;
	user_count: number;
	active_user_count: number;
}

interface ManagementBucketResponse {
	name: string;
	owner_id: string;
	created_at: string;
	object_count: number;
	total_object_bytes: number;
}

interface ManagementBucketsResponse {
	buckets: ManagementBucketResponse[];
}

interface ManagementObjectResponse {
	key: string;
	size: number;
	etag: string;
	content_type: string;
	created_at: string;
	updated_at: string;
}

interface ManagementObjectsResponse {
	bucket: string;
	is_truncated: boolean;
	next_cursor: string;
	objects: ManagementObjectResponse[];
	common_prefixes: string[];
}

interface ManagementKeyResponse {
	id: string;
	display_name: string;
	access_key_id: string;
	sigv4_access_key_id: string;
	role: 'admin' | 'member';
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

interface ManagementKeysResponse {
	keys: ManagementKeyResponse[];
}

interface ManagementCreateKeyResponse {
	key: ManagementKeyResponse;
	bearer_token: string;
	sigv4: {
		access_key_id: string;
		secret_key: string;
	};
}

function mapBucket(bucket: ManagementBucketResponse): Bucket {
	return {
		name: bucket.name,
		ownerId: bucket.owner_id,
		createdAt: bucket.created_at,
		objectCount: bucket.object_count,
		totalObjectBytes: bucket.total_object_bytes
	};
}

function mapObject(bucketName: string, object: ManagementObjectResponse): StorageObject {
	return {
		id: `${bucketName}/${object.key}`,
		bucketName,
		key: object.key,
		size: object.size,
		etag: object.etag,
		contentType: object.content_type,
		createdAt: object.created_at,
		updatedAt: object.updated_at
	};
}

function mapKey(key: ManagementKeyResponse): AccessKey {
	return {
		id: key.id,
		displayName: key.display_name,
		accessKeyId: key.access_key_id,
		sigV4AccessKeyId: key.sigv4_access_key_id,
		role: key.role,
		isActive: key.is_active,
		createdAt: key.created_at,
		updatedAt: key.updated_at
	};
}

function encodeObjectKeyPath(key: string): string {
	return key.split('/').map(encodeURIComponent).join('/');
}

async function readManagementErrorMessage(res: Response): Promise<string | null> {
	const contentType = res.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		try {
			const body = (await res.json()) as ManagementErrorResponse;
			return body.error?.message ?? null;
		} catch {
			return null;
		}
	}

	const text = await res.text().catch(() => '');
	return text.trim() || null;
}
