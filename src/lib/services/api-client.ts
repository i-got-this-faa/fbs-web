import type {
	AccessKey,
	ActivityItem,
	Bucket,
	BucketLocation,
	CopyObjectRequest,
	CopyObjectResult,
	CreateKeyRequest,
	CreateKeyResponse,
	DashboardMetrics,
	DeleteObjectsResult,
	FbsClient,
	HeadBucketResult,
	ListActivityOptions,
	ListObjectsOptions,
	ListObjectsV1Options,
	ObjectListing,
	ObjectListingV1,
	ObjectMetadata,
	PublicObjectUrl,
	S3BucketList,
	ServerConfig,
	StorageObject,
	UpdateKeyRequest,
	UploadObjectRequest
} from '$lib/types/api';
import { sha256Hex } from '$lib/utils/crypto';
import {
	buildDeleteObjectsXml,
	parseBucketLocation,
	parseCopyObjectResult,
	parseDeleteObjectsResult,
	parseListBuckets,
	parseListObjectsV1,
	parseS3ErrorMessage
} from '$lib/utils/s3-xml';

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

	// ── Server (Management API) ───────────────────────────────────────────
	async getConfig(): Promise<ServerConfig> {
		const res = await this.managementFetch('/config');
		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to load server config');
		}

		const body = (await res.json()) as ManagementConfigResponse;
		return mapConfig(body);
	}

	async listActivity(opts?: ListActivityOptions): Promise<ActivityItem[]> {
		const params = new URLSearchParams();
		if (opts?.bucket) params.set('bucket', opts.bucket);
		if (opts?.action) params.set('action', opts.action);
		if (opts?.limit) params.set('limit', String(opts.limit));

		const query = params.toString();
		const res = await this.managementFetch(`/activity${query ? `?${query}` : ''}`);
		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to load activity');
		}

		const body = (await res.json()) as ManagementActivityResponse;
		return body.activity.map(mapActivity);
	}

	// ── Buckets (S3) ──────────────────────────────────────────────────────

	/** S3 CreateBucket: PUT /{bucket} */
	async createBucket(name: string): Promise<Bucket> {
		const res = await this.s3Fetch(`/${encodeBucketName(name)}`, { method: 'PUT' });

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
			const res = await this.s3Fetch(`/${encodeBucketName(name)}?list-type=2&max-keys=0`);
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

	async getBucket(name: string): Promise<Bucket> {
		const res = await this.managementFetch(`/buckets/${encodeBucketName(name)}`);
		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to load bucket');
		}

		const body = (await res.json()) as ManagementBucketSummaryResponse;
		return mapBucket(body.bucket);
	}

	async deleteBucket(name: string): Promise<void> {
		const res = await this.managementFetch(`/buckets/${encodeBucketName(name)}`, {
			method: 'DELETE'
		});

		if (!res.ok && res.status !== 204) {
			await this.throwManagementError(res, 'Failed to delete bucket');
		}
	}

	async emptyBucket(name: string): Promise<void> {
		const res = await this.managementFetch(`/buckets/${encodeBucketName(name)}/empty`, {
			method: 'POST'
		});

		if (!res.ok && res.status !== 204) {
			await this.throwManagementError(res, 'Failed to empty bucket');
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
			`/buckets/${encodeBucketName(bucket)}/objects${query ? `?${query}` : ''}`
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
		const res = await this.s3Fetch(`/${encodeBucketName(bucket)}/${encodeObjectKeyPath(key)}`, {
			method: 'DELETE'
		});

		if (!res.ok && res.status !== 204) {
			await this.throwS3Error(res, 'Failed to delete object');
		}
	}

	/** Build a direct download URL for an object via the S3 endpoint */
	getObjectUrl(bucket: string, key: string): string {
		return `${this.baseUrl.replace(/\/$/, '')}/${encodeBucketName(bucket)}/${encodeObjectKeyPath(key)}`;
	}

	async createPublicObjectUrl(bucket: string, key: string): Promise<PublicObjectUrl> {
		const res = await this.managementFetch(
			`/buckets/${encodeBucketName(bucket)}/objects/${encodeObjectKeyPath(key)}/public-url`,
			{
				method: 'POST',
				body: JSON.stringify({})
			}
		);

		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to create public object URL');
		}

		const body = (await res.json()) as ManagementPublicObjectUrlResponse;
		return {
			url: body.url,
			expiresAt: body.expires_at,
			cacheControl: body.cache_control
		};
	}

	/** S3 PutObject: PUT /{bucket}/{key} */
	async uploadObject(req: UploadObjectRequest): Promise<void> {
		const headers: Record<string, string> = {};
		if (req.contentType) {
			headers['Content-Type'] = req.contentType;
		}

		const res = await this.s3Fetch(
			`/${encodeBucketName(req.bucket)}/${encodeObjectKeyPath(req.key)}`,
			{
				method: 'PUT',
				headers,
				body: req.body
			}
		);

		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to upload object');
		}
	}

	/** S3 HeadObject: HEAD /{bucket}/{key} */
	async headObject(bucket: string, key: string): Promise<ObjectMetadata> {
		const res = await this.s3Fetch(`/${encodeBucketName(bucket)}/${encodeObjectKeyPath(key)}`, {
			method: 'HEAD'
		});

		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to get object metadata');
		}

		return {
			key,
			bucketName: bucket,
			size: Number(res.headers.get('content-length') ?? 0),
			etag: res.headers.get('etag') ?? '',
			contentType: res.headers.get('content-type') ?? 'application/octet-stream',
			lastModified: res.headers.get('last-modified') ?? new Date().toISOString()
		};
	}

	async listBucketsS3(): Promise<S3BucketList> {
		const res = await this.s3Fetch('/');
		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to list buckets');
		}

		return parseListBuckets(await res.text());
	}

	async headBucketS3(name: string): Promise<HeadBucketResult> {
		const res = await this.s3Fetch(`/${encodeBucketName(name)}`, { method: 'HEAD' });
		if (res.ok) {
			return { exists: true, status: res.status };
		}
		if (res.status === 404) {
			return { exists: false, status: 404 };
		}

		await this.throwS3Error(res, 'Failed to check bucket');
		throw new Error('Failed to check bucket');
	}

	async deleteEmptyBucketS3(name: string): Promise<void> {
		const res = await this.s3Fetch(`/${encodeBucketName(name)}`, { method: 'DELETE' });
		if (!res.ok && res.status !== 204) {
			await this.throwS3Error(res, 'Failed to delete empty bucket');
		}
	}

	async getBucketLocation(name: string): Promise<BucketLocation> {
		const res = await this.s3Fetch(`/${encodeBucketName(name)}?location`);
		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to get bucket location');
		}

		return parseBucketLocation(await res.text(), name);
	}

	async listObjectsV1(bucket: string, opts?: ListObjectsV1Options): Promise<ObjectListingV1> {
		const params = new URLSearchParams();
		params.set('list-type', '1');
		if (opts?.prefix) params.set('prefix', opts.prefix);
		if (opts?.marker) params.set('marker', opts.marker);
		if (opts?.maxKeys) params.set('max-keys', String(opts.maxKeys));
		if (opts?.delimiter) params.set('delimiter', opts.delimiter);
		if (opts?.encodingType) params.set('encoding-type', opts.encodingType);

		const res = await this.s3Fetch(`/${encodeBucketName(bucket)}?${params.toString()}`);
		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to list objects');
		}

		return parseListObjectsV1(await res.text());
	}

	async copyObject(data: CopyObjectRequest): Promise<CopyObjectResult> {
		const headers: Record<string, string> = {
			'x-amz-copy-source': encodeCopySource(data.sourceBucket, data.sourceKey)
		};
		if (data.metadataDirective) {
			headers['x-amz-metadata-directive'] = data.metadataDirective;
		}
		if (data.metadataDirective === 'REPLACE' && data.contentType) {
			headers['Content-Type'] = data.contentType;
		}

		const res = await this.s3Fetch(
			`/${encodeBucketName(data.destinationBucket)}/${encodeObjectKeyPath(data.destinationKey)}`,
			{
				method: 'PUT',
				headers
			}
		);

		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to copy object');
		}

		return parseCopyObjectResult(await res.text());
	}

	async deleteObjects(bucket: string, keys: string[], quiet = false): Promise<DeleteObjectsResult> {
		if (keys.length === 0) return { deleted: [] };
		if (keys.length > 1000) {
			throw new Error('DeleteObjects supports at most 1000 keys per request');
		}

		const payload = buildDeleteObjectsXml(keys, quiet);
		const res = await this.s3Fetch(`/${encodeBucketName(bucket)}?delete`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/xml',
				'X-Amz-Content-SHA256': await sha256Hex(payload)
			},
			body: payload
		});

		if (!res.ok) {
			await this.throwS3Error(res, 'Failed to delete selected objects');
		}

		try {
			return parseDeleteObjectsResult(await res.text());
		} catch {
			throw new Error('Failed to delete selected objects');
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

	async updateKey(id: string, data: UpdateKeyRequest): Promise<AccessKey> {
		const body: ManagementUpdateKeyRequest = {};
		if (data.displayName !== undefined) body.display_name = data.displayName;
		if (data.isActive !== undefined) body.is_active = data.isActive;

		const res = await this.managementFetch(`/keys/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			await this.throwManagementError(res, 'Failed to update key');
		}

		const response = (await res.json()) as ManagementUpdateKeyResponse;
		return mapKey(response.key);
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

interface ManagementConfigResponse {
	region: string;
	dev_mode: boolean;
	public_base_url: string;
	limits: {
		s3_max_keys: number;
		s3_delete_objects: number;
		management_object_list_limit: number;
		management_activity_limit: number;
	};
}

interface ManagementActivityItemResponse {
	id: string;
	action: string;
	bucket: string;
	key?: string;
	size?: number;
	etag?: string;
	actor_user_id?: string;
	created_at: string;
}

interface ManagementActivityResponse {
	activity: ManagementActivityItemResponse[];
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

interface ManagementBucketSummaryResponse {
	bucket: ManagementBucketResponse;
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

interface ManagementPublicObjectUrlResponse {
	url: string;
	expires_at: string;
	cache_control: string;
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

interface ManagementUpdateKeyRequest {
	display_name?: string;
	is_active?: boolean;
}

interface ManagementUpdateKeyResponse {
	key: ManagementKeyResponse;
}

function mapConfig(config: ManagementConfigResponse): ServerConfig {
	return {
		region: config.region,
		devMode: config.dev_mode,
		publicBaseUrl: config.public_base_url,
		limits: {
			s3MaxKeys: config.limits.s3_max_keys,
			s3DeleteObjects: config.limits.s3_delete_objects,
			managementObjectListLimit: config.limits.management_object_list_limit,
			managementActivityLimit: config.limits.management_activity_limit
		}
	};
}

function mapActivity(activity: ManagementActivityItemResponse): ActivityItem {
	return {
		id: activity.id,
		action: activity.action,
		bucket: activity.bucket,
		key: activity.key,
		size: activity.size,
		etag: activity.etag,
		actorUserId: activity.actor_user_id,
		createdAt: activity.created_at
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

function encodeBucketName(name: string): string {
	return encodeURIComponent(name);
}

function encodeCopySource(bucket: string, key: string): string {
	return `/${encodeBucketName(bucket)}/${encodeObjectKeyPath(key)}`;
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
