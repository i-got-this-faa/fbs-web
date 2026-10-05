import type { CreateShareLinkRequest } from '$lib/types/api';

export const MAX_LINK_TTL_SECONDS = 100 * 365 * 24 * 60 * 60;

export function validateShareLinkRequest(req: CreateShareLinkRequest): void {
	if (!req.bucket.trim() || !req.key.replace(/^\//, '')) {
		throw new Error('Bucket and object key are required');
	}
	if (req.alias && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(req.alias)) {
		throw new Error(
			'Alias must be 3–64 letters, digits, hyphens or underscores, starting with a letter or digit'
		);
	}
	if (
		req.expiresInSeconds !== undefined &&
		(!Number.isSafeInteger(req.expiresInSeconds) ||
			req.expiresInSeconds <= 0 ||
			req.expiresInSeconds > MAX_LINK_TTL_SECONDS)
	) {
		throw new Error('Expiration must be a positive whole number of seconds, up to 100 years');
	}
}

export function contentDisposition(mode: 'inline' | 'attachment', key: string): string {
	const filename = (key.split('/').pop() || 'download')
		.replace(/[\r\n]/g, '')
		.replace(/["\\]/g, '\\$&');
	return `${mode}; filename="${filename}"`;
}
