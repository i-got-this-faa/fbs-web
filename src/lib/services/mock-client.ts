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

/** Simulates network delay */
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms + Math.random() * 100));

const randomId = () => crypto.randomUUID();
const isoNow = () => new Date().toISOString();
const isoAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

// ── Seed Data ───────────────────────────────────────────────────────────────
const MOCK_BUCKETS: Bucket[] = [
	{ name: 'media-assets', ownerId: 'usr_001', createdAt: isoAgo(30) },
	{ name: 'backups', ownerId: 'usr_001', createdAt: isoAgo(25) },
	{ name: 'user-uploads', ownerId: 'usr_002', createdAt: isoAgo(14) },
	{ name: 'static-site', ownerId: 'usr_001', createdAt: isoAgo(7) },
	{ name: 'logs', ownerId: 'usr_001', createdAt: isoAgo(3) }
];

const MOCK_OBJECTS: StorageObject[] = [
	// media-assets
	{
		id: randomId(),
		bucketName: 'media-assets',
		key: 'images/hero-banner.jpg',
		size: 2_450_000,
		etag: '"a1b2c3d4e5f6"',
		contentType: 'image/jpeg',
		createdAt: isoAgo(10),
		updatedAt: isoAgo(10)
	},
	{
		id: randomId(),
		bucketName: 'media-assets',
		key: 'images/logo.png',
		size: 45_200,
		etag: '"b2c3d4e5f6a1"',
		contentType: 'image/png',
		createdAt: isoAgo(9),
		updatedAt: isoAgo(9)
	},
	{
		id: randomId(),
		bucketName: 'media-assets',
		key: 'images/photos/team-photo.jpg',
		size: 5_800_000,
		etag: '"c3d4e5f6a1b2"',
		contentType: 'image/jpeg',
		createdAt: isoAgo(5),
		updatedAt: isoAgo(5)
	},
	{
		id: randomId(),
		bucketName: 'media-assets',
		key: 'videos/intro.mp4',
		size: 84_500_000,
		etag: '"d4e5f6a1b2c3"',
		contentType: 'video/mp4',
		createdAt: isoAgo(8),
		updatedAt: isoAgo(8)
	},
	{
		id: randomId(),
		bucketName: 'media-assets',
		key: 'documents/readme.md',
		size: 3_200,
		etag: '"e5f6a1b2c3d4"',
		contentType: 'text/markdown',
		createdAt: isoAgo(3),
		updatedAt: isoAgo(1)
	},
	// backups
	{
		id: randomId(),
		bucketName: 'backups',
		key: 'db/2026-04-10.sql.gz',
		size: 156_000_000,
		etag: '"f6a1b2c3d4e5"',
		contentType: 'application/gzip',
		createdAt: isoAgo(8),
		updatedAt: isoAgo(8)
	},
	{
		id: randomId(),
		bucketName: 'backups',
		key: 'db/2026-04-15.sql.gz',
		size: 162_000_000,
		etag: '"a1b2c3d4e501"',
		contentType: 'application/gzip',
		createdAt: isoAgo(3),
		updatedAt: isoAgo(3)
	},
	{
		id: randomId(),
		bucketName: 'backups',
		key: 'config/server.toml',
		size: 1_850,
		etag: '"b2c3d4e5f601"',
		contentType: 'application/toml',
		createdAt: isoAgo(2),
		updatedAt: isoAgo(1)
	},
	// user-uploads
	{
		id: randomId(),
		bucketName: 'user-uploads',
		key: 'avatars/user-001.webp',
		size: 28_400,
		etag: '"c3d4e5f6a102"',
		contentType: 'image/webp',
		createdAt: isoAgo(6),
		updatedAt: isoAgo(6)
	},
	{
		id: randomId(),
		bucketName: 'user-uploads',
		key: 'avatars/user-002.webp',
		size: 31_200,
		etag: '"d4e5f6a1b203"',
		contentType: 'image/webp',
		createdAt: isoAgo(4),
		updatedAt: isoAgo(4)
	},
	{
		id: randomId(),
		bucketName: 'user-uploads',
		key: 'files/report-q1.pdf',
		size: 4_200_000,
		etag: '"e5f6a1b2c304"',
		contentType: 'application/pdf',
		createdAt: isoAgo(2),
		updatedAt: isoAgo(2)
	},
	// static-site
	{
		id: randomId(),
		bucketName: 'static-site',
		key: 'index.html',
		size: 12_400,
		etag: '"f6a1b2c3d405"',
		contentType: 'text/html',
		createdAt: isoAgo(1),
		updatedAt: isoAgo(1)
	},
	{
		id: randomId(),
		bucketName: 'static-site',
		key: 'assets/style.css',
		size: 8_900,
		etag: '"a1b2c3d4e506"',
		contentType: 'text/css',
		createdAt: isoAgo(1),
		updatedAt: isoAgo(1)
	},
	{
		id: randomId(),
		bucketName: 'static-site',
		key: 'assets/app.js',
		size: 45_600,
		etag: '"b2c3d4e5f607"',
		contentType: 'application/javascript',
		createdAt: isoAgo(1),
		updatedAt: isoAgo(1)
	},
	// logs
	{
		id: randomId(),
		bucketName: 'logs',
		key: 'access/2026-04-17.log',
		size: 890_000,
		etag: '"c3d4e5f6a108"',
		contentType: 'text/plain',
		createdAt: isoAgo(0),
		updatedAt: isoAgo(0)
	}
];

const MOCK_KEYS: AccessKey[] = [
	{
		id: 'usr_001',
		displayName: 'Admin User',
		accessKeyId: 'AKFBS0001ADMIN',
		sigV4AccessKeyId: 'FBSK0001ADMIN',
		role: 'admin',
		isActive: true,
		createdAt: isoAgo(30),
		updatedAt: isoAgo(5)
	},
	{
		id: 'usr_002',
		displayName: 'App Service',
		accessKeyId: 'AKFBS0002SVCAPP',
		sigV4AccessKeyId: 'FBSK0002SVCAPP',
		role: 'member',
		isActive: true,
		createdAt: isoAgo(14),
		updatedAt: isoAgo(14)
	},
	{
		id: 'usr_003',
		displayName: 'CI Pipeline',
		accessKeyId: 'AKFBS0003CIPIPE',
		sigV4AccessKeyId: 'FBSK0003CIPIPE',
		role: 'member',
		isActive: false,
		createdAt: isoAgo(20),
		updatedAt: isoAgo(2)
	}
];

/**
 * Mock implementation of FbsClient for development before F10 is ready.
 * Returns realistic fake data matching the SQLite schema.
 */
export class MockFbsClient implements FbsClient {
	private buckets = [...MOCK_BUCKETS];
	private objects = [...MOCK_OBJECTS];
	private keys = [...MOCK_KEYS];

	async healthCheck(): Promise<boolean> {
		await delay(100);
		return true;
	}

	// ── Buckets ────────────────────────────────────────────────────────────
	async listBuckets(): Promise<Bucket[]> {
		await delay();
		return this.buckets.map((bucket) => {
			const objects = this.objects.filter((object) => object.bucketName === bucket.name);
			return {
				...bucket,
				objectCount: objects.length,
				totalObjectBytes: objects.reduce((sum, object) => sum + object.size, 0)
			};
		});
	}

	async createBucket(name: string): Promise<Bucket> {
		await delay();
		if (this.buckets.some((b) => b.name === name)) {
			throw new Error(`Bucket "${name}" already exists`);
		}
		const bucket: Bucket = {
			name,
			ownerId: 'usr_001',
			createdAt: isoNow(),
			objectCount: 0,
			totalObjectBytes: 0
		};
		this.buckets.push(bucket);
		return bucket;
	}

	async deleteBucket(name: string): Promise<void> {
		await delay();
		const idx = this.buckets.findIndex((b) => b.name === name);
		if (idx === -1) throw new Error(`Bucket "${name}" not found`);
		this.buckets.splice(idx, 1);
		this.objects = this.objects.filter((o) => o.bucketName !== name);
	}

	// ── Objects ────────────────────────────────────────────────────────────
	async listObjects(bucket: string, opts?: ListObjectsOptions): Promise<ObjectListing> {
		await delay();

		const prefix = opts?.prefix ?? '';
		const delimiter = opts?.delimiter ?? '';
		const startAfter = opts?.startAfter ?? '';
		const maxKeys = opts?.maxKeys ?? 1000;

		let filtered = this.objects
			.filter((o) => o.bucketName === bucket)
			.filter((o) => o.key.startsWith(prefix))
			.filter((o) => o.key > startAfter)
			.sort((a, b) => a.key.localeCompare(b.key));

		const commonPrefixes: string[] = [];

		if (delimiter) {
			const directObjects: StorageObject[] = [];
			const seenPrefixes = new Set<string>();

			for (const obj of filtered) {
				const rest = obj.key.slice(prefix.length);
				const delimIdx = rest.indexOf(delimiter);
				if (delimIdx >= 0) {
					const cp = prefix + rest.slice(0, delimIdx + 1);
					if (!seenPrefixes.has(cp)) {
						seenPrefixes.add(cp);
						commonPrefixes.push(cp);
					}
				} else {
					directObjects.push(obj);
				}
			}

			filtered = directObjects;
		}

		const isTruncated = filtered.length > maxKeys;
		const objects = filtered.slice(0, maxKeys);
		const nextStartAfter = isTruncated ? (objects[objects.length - 1]?.key ?? null) : null;

		return { objects, isTruncated, nextStartAfter, commonPrefixes };
	}

	async deleteObject(bucket: string, key: string): Promise<void> {
		await delay();
		const idx = this.objects.findIndex((o) => o.bucketName === bucket && o.key === key);
		if (idx === -1) throw new Error(`Object "${key}" not found in bucket "${bucket}"`);
		this.objects.splice(idx, 1);
	}

	// ── Keys ──────────────────────────────────────────────────────────────
	async listKeys(): Promise<AccessKey[]> {
		await delay();
		return [...this.keys];
	}

	async createKey(data: CreateKeyRequest): Promise<CreateKeyResponse> {
		await delay();
		const key: AccessKey = {
			id: randomId(),
			displayName: data.displayName,
			accessKeyId: `AKFBS${String(this.keys.length + 1).padStart(4, '0')}`,
			sigV4AccessKeyId: `FBSK${String(this.keys.length + 1).padStart(4, '0')}`,
			role: data.role,
			isActive: true,
			createdAt: isoNow(),
			updatedAt: isoNow()
		};
		this.keys.push(key);
		return {
			key,
			bearerToken: `AKFBS${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}.${crypto.randomUUID().replace(/-/g, '')}`,
			sigV4: {
				accessKeyId: key.sigV4AccessKeyId,
				secretKey: `fbs_${crypto.randomUUID().replace(/-/g, '')}`
			}
		};
	}

	async updateKey(
		id: string,
		data: Partial<Pick<AccessKey, 'displayName' | 'isActive'>>
	): Promise<AccessKey> {
		await delay();
		const key = this.keys.find((k) => k.id === id);
		if (!key) throw new Error(`Key "${id}" not found`);
		if (data.displayName !== undefined) key.displayName = data.displayName;
		if (data.isActive !== undefined) key.isActive = data.isActive;
		key.updatedAt = isoNow();
		return { ...key };
	}

	async deleteKey(id: string): Promise<void> {
		await delay();
		const idx = this.keys.findIndex((k) => k.id === id);
		if (idx === -1) throw new Error(`Key "${id}" not found`);
		this.keys.splice(idx, 1);
	}

	// ── Metrics ───────────────────────────────────────────────────────────
	async getMetrics(): Promise<DashboardMetrics> {
		await delay();
		return {
			totalBuckets: this.buckets.length,
			totalObjects: this.objects.length,
			totalStorageBytes: this.objects.reduce((sum, o) => sum + o.size, 0),
			totalKeys: this.keys.length,
			activeKeys: this.keys.filter((key) => key.isActive).length,
			recentUploads: [...this.objects]
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.slice(0, 5)
		};
	}
}
