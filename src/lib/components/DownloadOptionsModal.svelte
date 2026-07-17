<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import type { StorageObject } from '$lib/types/api';

	interface Props {
		open: boolean;
		object: StorageObject | null;
		onclose: () => void;
		ondownload: (expiresIn: number) => void;
		ongeneratelink: (expiresIn: number) => Promise<string>;
	}

	const { open, object, onclose, ondownload, ongeneratelink }: Props = $props();

	let expiresIn = $state(3600); // default 1 hour
	let copied = $state(false);
	let isGenerating = $state(false);
	let errorMessage = $state<string | null>(null);

	$effect(() => {
		if (open) {
			expiresIn = 3600;
			copied = false;
			isGenerating = false;
			errorMessage = null;
		}
	});

	async function handleCopyLink() {
		errorMessage = null;
		isGenerating = true;
		try {
			const url = await ongeneratelink(expiresIn);
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to generate link';
		} finally {
			isGenerating = false;
		}
	}
</script>

<Modal {open} title="Download / Share Object" {onclose}>
	{#if object}
		<div class="space-y-4">
			<div>
				<p class="text-xs font-semibold tracking-wider text-surface-500 uppercase">Object</p>
				<p class="mt-1 text-sm font-medium break-all text-surface-200">{object.key}</p>
			</div>

			<div class="space-y-2">
				<label
					for="download-expiry"
					class="block text-xs font-semibold tracking-wider text-surface-500 uppercase"
				>
					Link Expiration Duration
				</label>
				<select
					id="download-expiry"
					bind:value={expiresIn}
					class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
				>
					<option value={3600}>1 Hour</option>
					<option value={43200}>12 Hours</option>
					<option value={86400}>1 Day (24 Hours)</option>
					<option value={604800}>7 Days</option>
					<option value={3153600000}>Forever (100 Years)</option>
				</select>
				<p class="text-xs text-surface-600">
					All download links require a signed URL. Selecting a duration longer than the server's
					limit will automatically fall back to the maximum allowed lifetime.
				</p>
			</div>

			{#if errorMessage}
				<p
					class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-xs text-danger-400"
				>
					{errorMessage}
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
					type="button"
					onclick={handleCopyLink}
					disabled={isGenerating}
					class="min-w-[100px] rounded-lg bg-surface-800 px-4 py-2 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700 disabled:opacity-50"
				>
					{#if isGenerating}
						Generating…
					{:else if copied}
						Copied!
					{:else}
						Copy Link
					{/if}
				</button>
				<button
					type="button"
					onclick={() => ondownload(expiresIn)}
					class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
				>
					Download
				</button>
			</div>
		</div>
	{/if}
</Modal>
