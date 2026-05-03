<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';

	const { error }: { error: unknown } = $props();

	const parsedError = $derived.by((): App.Error => {
		if (isHttpError(error)) {
			return error.body;
		}

		console.error(error);

		return {
			message: 'Unknown error',
			kind: 'UnknownError',
			timestamp: Date.now()
		};
	});
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="max-w-md text-center">
		<div class="mb-4 text-5xl opacity-40">⚠️</div>
		<h2 class="mb-2 text-lg font-semibold text-surface-200">{parsedError.message}</h2>
		<p class="mb-1 text-sm text-surface-500">{parsedError.kind}</p>
		<p class="text-xs text-surface-600">
			{new Date(parsedError.timestamp).toLocaleString()}
		</p>
	</div>
</div>
