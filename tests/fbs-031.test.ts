import { describe, expect, test } from 'bun:test';
import { serve } from 'bun';
import { FbsApiClient } from '../src/lib/services/api-client';
import { MockFbsClient } from '../src/lib/services/mock-client';
import { MockShareLinks } from '../src/lib/services/mock-share-links';
import { completeMultipartUpload } from '../src/lib/services/multipart-completion';
import { S3RequestError } from '../src/lib/services/s3-error';
import { mergeGrants } from '../src/lib/utils/grants';
import { contentDisposition, validateShareLinkRequest } from '../src/lib/utils/share-links';
import type { CreateBucketGrantRequest } from '../src/lib/types/api';

describe('grant batches', () => {
	test('repeated requests return existing IDs and merge without duplicate rows', async () => {
		const client = new MockFbsClient();
		const req: CreateBucketGrantRequest = {
			granteeUserId: 'usr_002',
			actions: ['s3:GetObject', 's3:PutObject', 's3:GetObject'],
			keyPrefix: 'images/'
		};
		const first = await client.createBucketGrants('media-assets', req);
		const second = await client.createBucketGrants('media-assets', req);
		expect(first).toHaveLength(2);
		expect(second.map((grant) => grant.id)).toEqual(first.map((grant) => grant.id));
		expect(mergeGrants(first, second)).toHaveLength(2);
		const stored = await client.listBucketGrants('media-assets');
		expect(new Set(stored.map((grant) => grant.id)).size).toBe(stored.length);
	});

	test('failed validation preserves all existing grants', async () => {
		const client = new MockFbsClient();
		const before = structuredClone(await client.listBucketGrants('media-assets'));
		await expect(
			client.createBucketGrants('media-assets', {
				granteeUserId: 'missing',
				actions: ['s3:GetObject', 's3:PutObject'],
				keyPrefix: ''
			})
		).rejects.toThrow('Grantee not found');
		await expect(
			client.createBucketGrants('media-assets', {
				granteeUserId: 'usr_002',
				actions: ['s3:GetObject', 's3:PutObject'],
				keyPrefix: '../'
			})
		).rejects.toThrow('Invalid key prefix');
		expect(await client.listBucketGrants('media-assets')).toEqual(before);
	});

	test('inactive grantees are rejected without storing grants', async () => {
		const client = new MockFbsClient();
		await client.updateKey('usr_002', { isActive: false });
		const before = structuredClone(await client.listBucketGrants('media-assets'));
		await expect(
			client.createBucketGrants('media-assets', {
				granteeUserId: 'usr_002',
				actions: ['s3:PutObject'],
				keyPrefix: ''
			})
		).rejects.toThrow('inactive');
		expect(await client.listBucketGrants('media-assets')).toEqual(before);
	});
});

describe('share links', () => {
	test('maps the real HTTP contract, omits expiry for never, and encodes filters and revocation', async () => {
		const requests: { method: string; path: string; body: unknown }[] = [];
		const link = {
			code: 'test-code',
			url: 'https://example.test/s/test-code',
			bucket: 'media-assets',
			key: 'images/logo.png',
			created_by: 'user',
			expires_at: null,
			created_at: '2026-10-05T00:00:00Z'
		};
		const server = serve({
			port: 0,
			fetch: async (request) => {
				const url = new URL(request.url);
				requests.push({
					method: request.method,
					path: url.pathname + url.search,
					body: request.method === 'POST' ? await request.json() : null
				});
				if (request.method === 'POST') return Response.json(link, { status: 201 });
				if (request.method === 'DELETE') return new Response(null, { status: 204 });
				return Response.json({ share_links: [link] });
			}
		});
		try {
			const client = new FbsApiClient(server.url.toString(), 'test-token');
			const created = await client.createShareLink({ bucket: link.bucket, key: link.key });
			expect(created.expiresAt).toBeNull();
			expect(created.createdBy).toBe('user');
			expect(requests[0]?.body).toEqual({ bucket: link.bucket, key: link.key });
			expect(await client.listShareLinks('bucket & name')).toEqual([created]);
			await client.deleteShareLink('code/part');
			expect(requests[1]?.path).toBe('/api/management/share-links?bucket=bucket+%26+name');
			expect(requests[2]?.path).toBe('/api/management/share-links/code%2Fpart');
		} finally {
			server.stop(true);
		}
	});

	test('mock aliases conflict, expiry is optional, bucket deletion removes links', () => {
		const links = new MockShareLinks();
		const req = { bucket: 'media-assets', key: 'logo.png', alias: 'my-logo' };
		expect(links.create(req).expiresAt).toBeNull();
		expect(() => links.create(req)).toThrow('already in use');
		const expiring = links.create({ ...req, alias: 'other-logo', expiresInSeconds: 60 });
		expect(Date.parse(expiring.expiresAt ?? '')).toBeGreaterThan(Date.now());
		links.remove('my-logo');
		expect(links.list()).toHaveLength(1);
		links.removeBucket('media-assets');
		expect(links.list()).toEqual([]);
	});

	test('validates aliases and expiry and safely quotes filenames', () => {
		expect(() =>
			validateShareLinkRequest({ bucket: 'media-assets', key: 'logo.png', alias: 'a/../b' })
		).toThrow('Alias');
		expect(() =>
			validateShareLinkRequest({ bucket: 'media-assets', key: 'logo.png', expiresInSeconds: 0 })
		).toThrow('Expiration');
		expect(() =>
			validateShareLinkRequest({ bucket: 'media-assets', key: 'logo.png', expiresInSeconds: 0.5 })
		).toThrow('Expiration');
		expect(contentDisposition('attachment', 'images/my"file\n.png')).toBe(
			'attachment; filename="my\\"file.png"'
		);
	});

	test('rejects malformed responses at the API boundary', async () => {
		const server = serve({
			port: 0,
			fetch: () => Response.json({ share_links: [{ code: 'broken' }] })
		});
		try {
			await expect(new FbsApiClient(server.url.toString(), '').listShareLinks()).rejects.toThrow(
				'Invalid share-link response'
			);
		} finally {
			server.stop(true);
		}
	});
});

describe('signed links', () => {
	test('sends expiry and disposition and preserves the signed response', async () => {
		let requestBody: unknown;
		let requestPath = '';
		const response = {
			url: 'https://example.test/signed',
			expires_at: '2026-10-05T01:00:00Z',
			cache_control: 'public, max-age=60'
		};
		const server = serve({
			port: 0,
			fetch: async (request) => {
				requestBody = await request.json();
				requestPath = new URL(request.url).pathname;
				return Response.json(response);
			}
		});
		try {
			const result = await new FbsApiClient(
				server.url.toString(),
				'test-token'
			).createPublicObjectUrl('media-assets', 'folder/file name.txt', {
				expiresInSeconds: 60,
				responseContentDisposition: 'attachment; filename="file name.txt"'
			});
			expect(requestBody).toEqual({
				expires_in_seconds: 60,
				response_content_disposition: 'attachment; filename="file name.txt"'
			});
			expect(requestPath).toBe(
				'/api/management/buckets/media-assets/objects/folder/file%20name.txt/public-url'
			);
			expect(result).toEqual({
				url: response.url,
				expiresAt: response.expires_at,
				cacheControl: response.cache_control
			});
		} finally {
			server.stop(true);
		}
	});

	test('mock honors the default server TTL ceiling and download disposition', async () => {
		const client = new MockFbsClient();
		const object = (await client.listObjects('media-assets')).objects[0];
		if (!object) throw new Error('Mock fixture has no objects');
		const result = await client.createPublicObjectUrl('media-assets', object.key, {
			expiresInSeconds: 86400,
			responseContentDisposition: 'attachment'
		});
		expect(result.url).toContain('response-content-disposition=attachment');
		await expect(
			client.createPublicObjectUrl('media-assets', object.key, { expiresInSeconds: 86401 })
		).rejects.toThrow('maximum TTL');
	});
});

describe('multipart completion', () => {
	test.each([412, 404, 503])(
		'retries only the completion attempt after HTTP %s',
		async (status) => {
			let attempts = 0;
			let decisions = 0;
			await completeMultipartUpload(
				async () => {
					if (++attempts === 1)
						throw new S3RequestError(
							status,
							'<Error><Code>PreconditionFailed</Code></Error>',
							'Completion failed'
						);
				},
				{
					onCompletionError: async () => {
						decisions++;
						return 'retry';
					}
				}
			);
			expect(attempts).toBe(2);
			expect(decisions).toBe(1);
		}
	);

	test('abort choice preserves the completion error for cleanup', async () => {
		const error = new Error('failed completion');
		await expect(
			completeMultipartUpload(
				async () => {
					throw error;
				},
				{ onCompletionError: async () => 'abort' }
			)
		).rejects.toBe(error);
	});

	test('a missing upload is terminal and never offers a retry', async () => {
		let decisions = 0;
		await expect(
			completeMultipartUpload(
				async () => {
					throw new S3RequestError(404, '<Error><Code>NoSuchUpload</Code></Error>', 'Missing');
				},
				{
					onCompletionError: async () => {
						decisions++;
						return 'retry';
					}
				}
			)
		).rejects.toThrow('Missing');
		expect(decisions).toBe(0);
	});

	test('cancellation interrupts a pending decision without another request', async () => {
		const controller = new AbortController();
		let attempts = 0;
		let decideStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			decideStarted = resolve;
		});
		const result = completeMultipartUpload(
			async () => {
				attempts++;
				throw new Error('failed');
			},
			{
				signal: controller.signal,
				onCompletionError: () => {
					decideStarted?.();
					return new Promise(() => {});
				}
			}
		);
		await started;
		controller.abort();
		await expect(result).rejects.toMatchObject({ name: 'AbortError' });
		expect(attempts).toBe(1);
	});
});
