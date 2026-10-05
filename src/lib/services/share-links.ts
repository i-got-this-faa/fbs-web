import type { CreateShareLinkRequest, ShareLink } from '$lib/types/api';
import { validateShareLinkRequest } from '$lib/utils/share-links';

type ManagementFetch = (path: string, init?: RequestInit) => Promise<Response>;
type ThrowError = (response: Response, fallback: string) => Promise<never>;

/** Keeps the share-link Management API contract together. */
export class ShareLinksApi {
	constructor(
		private fetch: ManagementFetch,
		private throwError: ThrowError
	) {}

	async create(req: CreateShareLinkRequest): Promise<ShareLink> {
		validateShareLinkRequest(req);
		const res = await this.fetch('/share-links', {
			method: 'POST',
			body: JSON.stringify({
				bucket: req.bucket,
				key: req.key,
				alias: req.alias,
				expires_in_seconds: req.expiresInSeconds,
				response_content_disposition: req.responseContentDisposition
			})
		});
		if (!res.ok) await this.throwError(res, 'Failed to create share link');
		return mapShareLink(await res.json());
	}

	async list(bucket?: string): Promise<ShareLink[]> {
		const query = bucket ? `?${new URLSearchParams({ bucket })}` : '';
		const res = await this.fetch(`/share-links${query}`);
		if (!res.ok) await this.throwError(res, 'Failed to list share links');
		const body: unknown = await res.json();
		if (
			typeof body !== 'object' ||
			body === null ||
			!('share_links' in body) ||
			!Array.isArray(body.share_links)
		) {
			throw new Error('Invalid share-link list response');
		}
		return body.share_links.map(mapShareLink);
	}

	async remove(code: string): Promise<void> {
		const res = await this.fetch(`/share-links/${encodeURIComponent(code)}`, { method: 'DELETE' });
		if (!res.ok) await this.throwError(res, 'Failed to revoke share link');
	}
}

function mapShareLink(link: unknown): ShareLink {
	if (
		typeof link !== 'object' ||
		link === null ||
		!('code' in link) ||
		typeof link.code !== 'string' ||
		!('url' in link) ||
		typeof link.url !== 'string' ||
		!('bucket' in link) ||
		typeof link.bucket !== 'string' ||
		!('key' in link) ||
		typeof link.key !== 'string' ||
		!('created_by' in link) ||
		typeof link.created_by !== 'string' ||
		!('created_at' in link) ||
		typeof link.created_at !== 'string' ||
		!('expires_at' in link) ||
		(link.expires_at !== null && typeof link.expires_at !== 'string') ||
		('response_content_disposition' in link &&
			typeof link.response_content_disposition !== 'string')
	) {
		throw new Error('Invalid share-link response');
	}
	return {
		code: link.code,
		url: link.url,
		bucket: link.bucket,
		key: link.key,
		responseContentDisposition:
			'response_content_disposition' in link &&
			typeof link.response_content_disposition === 'string'
				? link.response_content_disposition
				: undefined,
		createdBy: link.created_by,
		expiresAt: link.expires_at,
		createdAt: link.created_at
	};
}
