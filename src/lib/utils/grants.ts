import type { BucketGrant } from '$lib/types/api';

/** A repeated create request can return grants already present in the list. */
export function mergeGrants(current: BucketGrant[], returned: BucketGrant[]): BucketGrant[] {
	return [...new Map([...current, ...returned].map((grant) => [grant.id, grant])).values()];
}
