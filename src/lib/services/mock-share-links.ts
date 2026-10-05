import type { CreateShareLinkRequest, ShareLink } from '$lib/types/api';
import { validateShareLinkRequest } from '$lib/utils/share-links';

/** In-memory management behavior; mock URLs do not serve actual media. */
export class MockShareLinks {
	private links: ShareLink[] = [];

	create(req: CreateShareLinkRequest): ShareLink {
		validateShareLinkRequest(req);
		const code = req.alias || crypto.randomUUID().replaceAll('-', '').slice(0, 10);
		if (this.links.some((link) => link.code === code)) throw new Error('Alias is already in use');
		const link: ShareLink = {
			code,
			url: `mock://localhost/s/${code}`,
			bucket: req.bucket.trim(),
			key: req.key.replace(/^\//, ''),
			responseContentDisposition: req.responseContentDisposition,
			createdBy: 'usr_001',
			expiresAt:
				req.expiresInSeconds === undefined
					? null
					: new Date(Date.now() + req.expiresInSeconds * 1000).toISOString(),
			createdAt: new Date().toISOString()
		};
		this.links.push(link);
		return { ...link };
	}

	list(bucket?: string): ShareLink[] {
		return this.links
			.filter((link) => !bucket || link.bucket === bucket)
			.map((link) => ({ ...link }));
	}

	remove(code: string): void {
		if (!this.links.some((link) => link.code === code)) throw new Error('Share link not found');
		this.links = this.links.filter((link) => link.code !== code);
	}

	removeBucket(bucket: string): void {
		this.links = this.links.filter((link) => link.bucket !== bucket);
	}
}
