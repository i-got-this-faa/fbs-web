<script lang="ts">
</script>

<svelte:head><title>Access Keys — FBS</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<div class="rounded-xl border border-dashed border-surface-700 bg-surface-900/30 p-12">
		<div class="flex flex-col items-center text-center">
			<div class="mb-4 text-4xl opacity-30">🔑</div>
			<p class="text-sm font-medium text-surface-300">Management API Required</p>
			<p class="mt-2 max-w-md text-xs leading-relaxed text-surface-500">
				Key management (create, revoke, list access keys) requires the Management API layer, which
				is coming soon. In the meantime, access keys can be managed directly in the database or
				through the S3 API with SigV4 authentication.
			</p>
		</div>
	</div>
</div>
