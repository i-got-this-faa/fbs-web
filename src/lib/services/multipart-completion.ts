import type { UploadObjectOptions } from '$lib/types/api';
import { S3RequestError } from './s3-error';

/** Retry only completion, keeping the same upload ID and uploaded parts. */
export async function completeMultipartUpload(
	attempt: () => Promise<void>,
	options?: UploadObjectOptions
): Promise<void> {
	while (true) {
		if (options?.signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
		try {
			await attempt();
			return;
		} catch (err) {
			if (options?.signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
			if (
				!(err instanceof Error) ||
				!options?.onCompletionError ||
				(err instanceof S3RequestError && err.code === 'NoSuchUpload')
			)
				throw err;
			const decision = await waitForDecision(err, options.onCompletionError, options.signal);
			if (decision !== 'retry') throw err;
		}
	}
}

function waitForDecision(
	error: Error,
	decide: NonNullable<UploadObjectOptions['onCompletionError']>,
	signal?: AbortSignal
): Promise<'retry' | 'abort'> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
		if (signal?.aborted) {
			abort();
			return;
		}
		signal?.addEventListener('abort', abort, { once: true });
		Promise.resolve()
			.then(() => decide(error))
			.then(resolve, reject)
			.finally(() => signal?.removeEventListener('abort', abort));
	});
}
