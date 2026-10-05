import {
	GRANT_ACTIONS,
	type AccessKey,
	type BucketGrant,
	type CreateBucketGrantRequest
} from '$lib/types/api';

/** Validate before constructing a batch so an invalid request leaves existing grants intact. */
export function createMockGrantBatch(
	current: BucketGrant[],
	keys: AccessKey[],
	bucket: string,
	req: CreateBucketGrantRequest
): BucketGrant[] {
	if (Boolean(req.granteeUserId) === Boolean(req.granteeAccessKeyId)) {
		throw new Error('Provide exactly one grantee user ID or access key ID');
	}
	const grantee = keys.find((key) =>
		req.granteeUserId
			? key.id === req.granteeUserId
			: key.accessKeyId === req.granteeAccessKeyId ||
				key.sigV4AccessKeyId === req.granteeAccessKeyId
	);
	if (!grantee) throw new Error('Grantee not found');
	if (!grantee.isActive) throw new Error('Grantee is inactive');
	const actions = [...new Set(req.actions)];
	if (!actions.length || actions.some((action) => !GRANT_ACTIONS.includes(action))) {
		throw new Error('Invalid or non-grantable action');
	}
	if (
		/[\0\r\n]/.test(req.keyPrefix) ||
		req.keyPrefix.startsWith('/') ||
		new TextEncoder().encode(req.keyPrefix.replace(/\/$/, '')).length > 1024 ||
		req.keyPrefix
			.replaceAll('\\', '/')
			.split('/')
			.some((segment) => segment === '..') ||
		(req.keyPrefix.split('/').every((segment) => segment === '' || segment === '.') &&
			req.keyPrefix !== '')
	) {
		throw new Error('Invalid key prefix');
	}
	return actions.map(
		(action) =>
			current.find(
				(grant) =>
					grant.isActive &&
					grant.bucket === bucket &&
					grant.granteeUserId === grantee.id &&
					grant.action === action &&
					grant.keyPrefix === req.keyPrefix
			) ?? {
				id: `gnt_${crypto.randomUUID()}`,
				bucket,
				granteeUserId: grantee.id,
				action,
				keyPrefix: req.keyPrefix,
				isActive: true,
				createdBy: 'usr_001',
				note: req.note,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
	);
}
