import { parseS3ErrorMessage } from '$lib/utils/s3-xml';

/** Preserves protocol details needed to decide whether an upload can retry. */
export class S3RequestError extends Error {
	readonly code: string | null;
	constructor(
		readonly status: number,
		body: string,
		fallback: string
	) {
		super(parseS3ErrorMessage(body) || `${fallback} (HTTP ${status})`);
		this.name = 'S3RequestError';
		this.code = body.match(/<Code>(.*?)<\/Code>/)?.[1] ?? null;
	}
}
