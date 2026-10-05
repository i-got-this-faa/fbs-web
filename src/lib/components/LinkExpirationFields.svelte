<script lang="ts">
	import { MAX_LINK_TTL_SECONDS } from '$lib/utils/share-links';
	let {
		allowNever,
		preset = $bindable('3600'),
		customSeconds = $bindable<number | undefined>(3600)
	}: { allowNever: boolean; preset?: string; customSeconds?: number } = $props();
</script>

<div>
	<label for="link-expiration" class="mb-1 block text-xs text-surface-400">Expiration</label>
	<select
		id="link-expiration"
		bind:value={preset}
		class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200"
	>
		<option value="3600">1 hour</option><option value="21600">6 hours</option>
		<option value="86400">1 day</option><option value="604800">7 days</option>
		<option value="2592000">30 days</option><option value="31536000">1 year</option>
		<option value="315360000">10 years</option><option value={String(MAX_LINK_TTL_SECONDS)}
			>100 years</option
		>
		<option value="custom">Custom</option>
		{#if allowNever}<option value="never">Never</option>{/if}
	</select>
	{#if preset === 'custom'}
		<label for="link-seconds" class="mt-2 mb-1 block text-xs text-surface-400"
			>Custom duration in seconds</label
		>
		<input
			id="link-seconds"
			type="number"
			min="1"
			max={MAX_LINK_TTL_SECONDS}
			step="1"
			required
			bind:value={customSeconds}
			class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200"
		/>
	{/if}
</div>
