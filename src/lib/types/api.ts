// ── Bucket ──────────────────────────────────────────────────────────────────
/** Mirrors Go `metadata.Bucket` */
export interface Bucket {
	name: string;
	ownerId: string;
	createdAt: string; // ISO 8601
}

// ── Object ──────────────────────────────────────────────────────────────────
/** Mirrors Go `metadata.Object` (excludes storage_path — internal only) */
export interface StorageObject {
	id: string;
	bucketName: string;
	key: string;
	size: number;
	etag: string;
	contentType: string;
	createdAt: string;
	updatedAt: string;
}

/** Paginated object listing result, mirrors ListObjectsV2 semantics */
export interface ObjectListing {
	objects: StorageObject[];
	isTruncated: boolean;
	nextStartAfter: string | null;
	commonPrefixes: string[];
}

// ── Access Key ──────────────────────────────────────────────────────────────
/** Mirrors Go `metadata.User` (sans secret_hash — never exposed) */
export interface AccessKey {
	id: string;
	displayName: string;
	accessKeyId: string;
	role: 'admin' | 'member';
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

/** Response when creating a new key — secret shown once */
export interface CreateKeyResponse {
	key: AccessKey;
	secretAccessKey: string;
}

export interface CreateKeyRequest {
	displayName: string;
	role: 'admin' | 'member';
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardMetrics {
	totalBuckets: number;
	totalObjects: number;
	totalStorageBytes: number;
	recentUploads: StorageObject[];
}

// ── API Client Interface ────────────────────────────────────────────────────
export interface ListObjectsOptions {
	prefix?: string;
	startAfter?: string;
	maxKeys?: number;
	delimiter?: string;
}

export interface FbsClient {
	healthCheck(): Promise<boolean>;
	// Buckets
	listBuckets(): Promise<Bucket[]>;
	createBucket(name: string): Promise<Bucket>;
	deleteBucket(name: string): Promise<void>;
	// Objects
	listObjects(bucket: string, opts?: ListObjectsOptions): Promise<ObjectListing>;
	deleteObject(bucket: string, key: string): Promise<void>;
	// Keys
	listKeys(): Promise<AccessKey[]>;
	createKey(data: CreateKeyRequest): Promise<CreateKeyResponse>;
	updateKey(
		id: string,
		data: Partial<Pick<AccessKey, 'displayName' | 'isActive'>>
	): Promise<AccessKey>;
	deleteKey(id: string): Promise<void>;
	// Metrics
	getMetrics(): Promise<DashboardMetrics>;
}
