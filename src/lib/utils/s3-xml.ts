import type { ObjectListing, StorageObject } from '$lib/types/api';

/**
 * Parse an S3 XML error response and extract the human-readable message.
 * Returns null if parsing fails (non-XML error body).
 */
export function parseS3ErrorMessage(xml: string): string | null {
	const msgMatch = xml.match(/<Message>(.*?)<\/Message>/);
	const codeMatch = xml.match(/<Code>(.*?)<\/Code>/);
	if (msgMatch) {
		return codeMatch ? `${codeMatch[1]}: ${msgMatch[1]}` : msgMatch[1];
	}
	return null;
}

/**
 * Parse an S3 ListObjectsV2 XML response into our ObjectListing shape.
 */
export function parseListObjectsV2(xml: string): ObjectListing {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'application/xml');

	const objects: StorageObject[] = [];
	const commonPrefixes: string[] = [];

	const bucketName = getTextContent(doc, 'Name') ?? '';

	// Parse <Contents> elements
	for (const el of doc.querySelectorAll('Contents')) {
		const key = getTextContent(el, 'Key') ?? '';
		const lastModified = getTextContent(el, 'LastModified') ?? '';
		const etag = getTextContent(el, 'ETag') ?? '';
		const size = parseInt(getTextContent(el, 'Size') ?? '0', 10);

		objects.push({
			id: `${bucketName}/${key}`,
			bucketName,
			key,
			size,
			etag: etag.replace(/&quot;|"/g, ''),
			contentType: guessContentType(key),
			createdAt: lastModified,
			updatedAt: lastModified
		});
	}

	// Parse <CommonPrefixes> elements
	for (const el of doc.querySelectorAll('CommonPrefixes')) {
		const prefix = getTextContent(el, 'Prefix');
		if (prefix) commonPrefixes.push(prefix);
	}

	const isTruncated = getTextContent(doc, 'IsTruncated') === 'true';
	const nextToken = getTextContent(doc, 'NextContinuationToken');

	return {
		objects,
		isTruncated,
		nextStartAfter: nextToken ?? null,
		commonPrefixes
	};
}

function getTextContent(parent: Document | Element, tagName: string): string | null {
	const el = parent.querySelector(tagName);
	return el?.textContent ?? null;
}

/** Best-effort content type guess from file extension (S3 ListObjectsV2 doesn't include it) */
function guessContentType(key: string): string {
	const ext = key.split('.').pop()?.toLowerCase() ?? '';
	const map: Record<string, string> = {
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		mp4: 'video/mp4',
		webm: 'video/webm',
		mp3: 'audio/mpeg',
		wav: 'audio/wav',
		pdf: 'application/pdf',
		json: 'application/json',
		xml: 'application/xml',
		html: 'text/html',
		css: 'text/css',
		js: 'application/javascript',
		ts: 'application/typescript',
		txt: 'text/plain',
		md: 'text/markdown',
		csv: 'text/csv',
		zip: 'application/zip',
		gz: 'application/gzip',
		tar: 'application/x-tar',
		toml: 'application/toml',
		yaml: 'application/yaml',
		yml: 'application/yaml',
		sql: 'application/sql',
		log: 'text/plain'
	};
	return map[ext] ?? 'application/octet-stream';
}
