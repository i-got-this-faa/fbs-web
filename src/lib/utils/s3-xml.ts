import type {
	BucketLocation,
	CopyObjectResult,
	DeleteObjectsResult,
	ObjectListing,
	ObjectListingV1,
	S3BucketList,
	StorageObject
} from '$lib/types/api';

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

export function parseListBuckets(xml: string): S3BucketList {
	const doc = parseXml(xml);
	const buckets = Array.from(doc.querySelectorAll('Bucket')).map((bucket) => ({
		name: getTextContent(bucket, 'Name') ?? '',
		createdAt: getTextContent(bucket, 'CreationDate') ?? ''
	}));

	return {
		owner: {
			id: getTextContent(doc, 'Owner > ID') ?? getTextContent(doc, 'ID') ?? '',
			displayName:
				getTextContent(doc, 'Owner > DisplayName') ?? getTextContent(doc, 'DisplayName') ?? ''
		},
		buckets
	};
}

export function parseBucketLocation(xml: string, bucket: string): BucketLocation {
	const doc = parseXml(xml);
	const region = getTextContent(doc, 'LocationConstraint') || 'us-east-1';
	return { bucket, region };
}

/**
 * Parse an S3 ListObjectsV2 XML response into our ObjectListing shape.
 */
export function parseListObjectsV2(xml: string): ObjectListing {
	const doc = parseXml(xml);

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

export function parseListObjectsV1(xml: string): ObjectListingV1 {
	const doc = parseXml(xml);
	const objects = parseContents(doc);
	const commonPrefixes = parseCommonPrefixes(doc);
	const isTruncated = getTextContent(doc, 'IsTruncated') === 'true';
	const nextMarker =
		getTextContent(doc, 'NextMarker') ??
		(isTruncated ? (objects[objects.length - 1]?.key ?? null) : null);

	return {
		objects,
		commonPrefixes,
		isTruncated,
		nextMarker
	};
}

export function parseCopyObjectResult(xml: string): CopyObjectResult {
	const doc = parseXml(xml);
	return {
		etag: normalizeEtag(getTextContent(doc, 'ETag') ?? ''),
		lastModified: getTextContent(doc, 'LastModified') ?? ''
	};
}

export function parseDeleteObjectsResult(xml: string): DeleteObjectsResult {
	const doc = parseXml(xml);
	const deleted = Array.from(doc.querySelectorAll('Deleted'))
		.map((node) => getTextContent(node, 'Key'))
		.filter((key): key is string => key !== null);

	return { deleted };
}

export function parseInitiateMultipartUploadResult(xml: string): {
	bucket: string;
	key: string;
	uploadId: string;
} {
	const doc = parseXml(xml);
	const uploadId = getTextContent(doc, 'UploadId');
	if (!uploadId) {
		throw new Error('Multipart upload response did not include an UploadId');
	}

	return {
		bucket: getTextContent(doc, 'Bucket') ?? '',
		key: getTextContent(doc, 'Key') ?? '',
		uploadId
	};
}

export function buildDeleteObjectsXml(keys: string[], quiet = false): string {
	const objects = keys.map((key) => `<Object><Key>${escapeXml(key)}</Key></Object>`).join('');
	return `<Delete><Quiet>${quiet ? 'true' : 'false'}</Quiet>${objects}</Delete>`;
}

export function buildCompleteMultipartUploadXml(
	parts: Array<{ partNumber: number; etag: string }>
): string {
	const partXml = parts
		.map(
			(part) =>
				`<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXml(part.etag)}</ETag></Part>`
		)
		.join('');
	return `<CompleteMultipartUpload>${partXml}</CompleteMultipartUpload>`;
}

function parseXml(xml: string): Document {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'application/xml');
	const parserError = doc.querySelector('parsererror');
	if (parserError) {
		throw new Error(parserError.textContent ?? 'Invalid XML response');
	}
	return doc;
}

function getTextContent(parent: Document | Element, tagName: string): string | null {
	const el = parent.querySelector(tagName);
	return el?.textContent ?? null;
}

function parseContents(doc: Document): StorageObject[] {
	const bucketName = getTextContent(doc, 'Name') ?? '';

	return Array.from(doc.querySelectorAll('Contents')).map((el) => {
		const key = getTextContent(el, 'Key') ?? '';
		const lastModified = getTextContent(el, 'LastModified') ?? '';
		const etag = getTextContent(el, 'ETag') ?? '';
		const size = parseInt(getTextContent(el, 'Size') ?? '0', 10);

		return {
			id: `${bucketName}/${key}`,
			bucketName,
			key,
			size,
			etag: normalizeEtag(etag),
			contentType: guessContentType(key),
			createdAt: lastModified,
			updatedAt: lastModified
		};
	});
}

function parseCommonPrefixes(doc: Document): string[] {
	return Array.from(doc.querySelectorAll('CommonPrefixes'))
		.map((el) => getTextContent(el, 'Prefix'))
		.filter((prefix): prefix is string => prefix !== null);
}

function normalizeEtag(etag: string): string {
	return etag.replace(/&quot;|"/g, '');
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
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
