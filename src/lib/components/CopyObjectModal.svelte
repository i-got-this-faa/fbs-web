<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import type { StorageObject } from '$lib/types/api';

	interface Props {
		open: boolean;
		source: StorageObject | null;
		destinationBucket: string;
		destinationKey: string;
		metadataDirective: 'COPY' | 'REPLACE';
		contentType: string;
		error: string | null;
		onsubmit: (event: Event) => void;
		onclose: () => void;
	}

	let {
		open,
		source,
		destinationBucket = $bindable(),
		destinationKey = $bindable(),
		metadataDirective = $bindable(),
		contentType = $bindable(),
		error,
		onsubmit,
		onclose
	}: Props = $props();
</script>

<Modal
	{open}
	title="Copy Object"
	description="Copy this object to a destination bucket and key."
	{onclose}
>
	<form class="space-y-4" {onsubmit}>
		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label for="source-bucket" class="mb-1.5 block text-sm font-medium text-surface-300">
					Source bucket
				</label>
				<input
					id="source-bucket"
					type="text"
					value={source?.bucketName ?? ''}
					readonly
					class="w-full rounded-lg border border-surface-700 bg-surface-950 px-3.5 py-2 text-sm text-surface-400 outline-none"
				/>
			</div>
			<div>
				<label for="source-key" class="mb-1.5 block text-sm font-medium text-surface-300">
					Source key
				</label>
				<input
					id="source-key"
					type="text"
					value={source?.key ?? ''}
					readonly
					class="w-full rounded-lg border border-surface-700 bg-surface-950 px-3.5 py-2 text-sm text-surface-400 outline-none"
				/>
			</div>
		</div>

		<div>
			<label for="destination-bucket" class="mb-1.5 block text-sm font-medium text-surface-300">
				Destination bucket
			</label>
			<input
				id="destination-bucket"
				type="text"
				bind:value={destinationBucket}
				required
				class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
			/>
		</div>

		<div>
			<label for="destination-key" class="mb-1.5 block text-sm font-medium text-surface-300">
				Destination key
			</label>
			<input
				id="destination-key"
				type="text"
				bind:value={destinationKey}
				required
				class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
			/>
		</div>

		<div>
			<label for="metadata-directive" class="mb-1.5 block text-sm font-medium text-surface-300">
				Metadata directive
			</label>
			<select
				id="metadata-directive"
				bind:value={metadataDirective}
				class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
			>
				<option value="COPY">COPY</option>
				<option value="REPLACE">REPLACE</option>
			</select>
		</div>

		{#if metadataDirective === 'REPLACE'}
			<div>
				<label for="copy-content-type" class="mb-1.5 block text-sm font-medium text-surface-300">
					Content type
				</label>
				<input
					id="copy-content-type"
					type="text"
					bind:value={contentType}
					placeholder="application/octet-stream"
					class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 placeholder-surface-600 outline-none focus:border-accent-500"
				/>
			</div>
		{/if}

		{#if error}
			<p
				class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-sm text-danger-400"
			>
				{error}
			</p>
		{/if}

		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={onclose}
				class="rounded-lg px-4 py-2 text-sm font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
			>
				Cancel
			</button>
			<button
				type="submit"
				class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
			>
				Copy Object
			</button>
		</div>
	</form>
</Modal>
