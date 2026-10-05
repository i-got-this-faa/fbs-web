<script lang="ts">
	import { onDestroy } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import LinkExpirationFields from '$lib/components/LinkExpirationFields.svelte';
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import { getShareLinksContext } from '$lib/stores/share-links.svelte';
	import type { StorageObject } from '$lib/types/api';
	import { contentDisposition, MAX_LINK_TTL_SECONDS } from '$lib/utils/share-links';

	const { object, onclose }: { object: StorageObject; onclose: () => void } = $props();
	const connection = getConnectionContext();
	const shareLinks = getShareLinksContext();
	let mode = $state<'share' | 'signed'>('share');
	let expiryPreset = $state('3600');
	let customSeconds = $state<number | undefined>(3600);
	const expiresIn = $derived(
		expiryPreset === 'never'
			? null
			: expiryPreset === 'custom'
				? customSeconds
				: Number(expiryPreset)
	);
	let alias = $state('');
	let disposition = $state<'inline' | 'attachment'>('inline');
	let generatedUrl = $state<string | null>(null);
	let generatedExpiry = $state<string | null>(null);
	let isGenerating = $state(false);
	let copied = $state(false);
	let error = $state<string | null>(null);
	let disposed = false;
	onDestroy(() => {
		disposed = true;
	});

	function changeMode(value: 'share' | 'signed') {
		mode = value;
		if (value === 'signed' && expiryPreset === 'never') expiryPreset = '3600';
	}

	async function generate(event: SubmitEvent) {
		event.preventDefault();
		const client = connection.client;
		if (!client || isGenerating) return;
		if (
			expiresIn !== null &&
			(expiresIn === undefined ||
				!Number.isSafeInteger(expiresIn) ||
				expiresIn <= 0 ||
				expiresIn > MAX_LINK_TTL_SECONDS)
		) {
			error = 'Choose a positive whole number of seconds, up to 100 years';
			return;
		}
		isGenerating = true;
		error = null;
		try {
			const link =
				mode === 'share'
					? await shareLinks.create({
							bucket: object.bucketName,
							key: object.key,
							alias: alias.trim() || undefined,
							expiresInSeconds: expiresIn ?? undefined,
							responseContentDisposition: contentDisposition(disposition, object.key)
						})
					: await client.createPublicObjectUrl(object.bucketName, object.key, {
							expiresInSeconds: expiresIn ?? 3600,
							responseContentDisposition: contentDisposition(disposition, object.key)
						});
			if (!disposed) {
				generatedUrl = link.url;
				generatedExpiry = link.expiresAt;
			}
		} catch (err) {
			if (!disposed) error = err instanceof Error ? err.message : 'Failed to create link';
		} finally {
			if (!disposed) isGenerating = false;
		}
	}

	async function copy() {
		if (!generatedUrl) return;
		try {
			await navigator.clipboard.writeText(generatedUrl);
			if (!disposed) {
				copied = true;
				error = null;
			}
		} catch {
			if (!disposed) error = 'Clipboard unavailable. Select and copy the URL below.';
		}
	}
</script>

<Modal open title="Share object" {onclose}>
	<p class="mb-4 text-sm break-all text-surface-200">{object.key}</p>
	{#if generatedUrl}
		<div class="space-y-4">
			<label for="generated-link" class="block text-xs text-surface-400"
				>{mode === 'share' ? 'Share link' : 'Signed link'}</label
			>
			<input
				id="generated-link"
				readonly
				value={generatedUrl}
				class="w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-surface-200"
			/>
			<p class="text-xs text-surface-400">
				{generatedExpiry
					? `Expires ${new Date(generatedExpiry).toLocaleString()}`
					: 'Never expires. Revoke it from the bucket’s Share links tab.'}
			</p>
			{#if error}<p role="alert" class="text-sm text-danger-400">{error}</p>{/if}
			<div class="flex justify-end gap-3">
				<button
					onclick={onclose}
					class="rounded-lg px-3 py-2 text-sm text-surface-400 hover:bg-surface-800">Close</button
				>
				<button
					onclick={copy}
					class="rounded-lg bg-accent-500/15 px-3 py-2 text-sm text-accent-400 hover:bg-accent-500/25"
					>{copied ? 'Copied!' : 'Copy link'}</button
				>
			</div>
		</div>
	{:else}
		<form onsubmit={generate} class="space-y-4">
			<fieldset disabled={isGenerating} class="space-y-4 disabled:opacity-60">
				<div class="flex gap-2" aria-label="Link type">
					{#each ['share', 'signed'] as value (value)}
						<button
							type="button"
							aria-pressed={mode === value}
							onclick={() => changeMode(value === 'share' ? 'share' : 'signed')}
							class="rounded-lg px-3 py-2 text-sm {mode === value
								? 'bg-accent-500/15 text-accent-400'
								: 'bg-surface-800 text-surface-400'}"
							>{value === 'share' ? 'Short share link' : 'Signed link'}</button
						>
					{/each}
				</div>
				{#if mode === 'share'}
					<div>
						<label for="share-alias" class="mb-1 block text-xs text-surface-400"
							>Custom alias, optional</label
						>
						<input
							id="share-alias"
							bind:value={alias}
							minlength="3"
							maxlength="64"
							pattern={'[a-zA-Z0-9][a-zA-Z0-9_\\-]{2,63}'}
							placeholder="Leave blank for a random code"
							class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 outline-none focus:border-accent-500"
						/>
						<p class="mt-1 text-xs text-surface-500">
							Aliases are easy to guess. Use a random code for private content.
						</p>
					</div>
				{/if}
				<div>
					<label for="share-disposition" class="mb-1 block text-xs text-surface-400"
						>When opened</label
					>
					<select
						id="share-disposition"
						bind:value={disposition}
						class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200"
					>
						<option value="inline">View in browser</option><option value="attachment"
							>Download file</option
						>
					</select>
				</div>
				<LinkExpirationFields
					allowNever={mode === 'share'}
					bind:preset={expiryPreset}
					bind:customSeconds
				/>
			</fieldset>
			<p class="text-xs text-surface-500">
				{mode === 'share'
					? 'Anyone with the link can read this object. Revoke it from Share links. Overwriting the object changes the shared content; deactivating the creator disables their links.'
					: 'Signed links require server signing configuration and cannot be revoked individually. The server rejects durations above its configured maximum.'}
			</p>
			{#if error}<p role="alert" class="text-sm text-danger-400">{error}</p>{/if}
			<div class="flex justify-end gap-3">
				<button
					type="button"
					onclick={onclose}
					class="rounded-lg px-3 py-2 text-sm text-surface-400 hover:bg-surface-800">Cancel</button
				>
				<button
					type="submit"
					disabled={isGenerating}
					class="rounded-lg bg-accent-500/15 px-3 py-2 text-sm text-accent-400 hover:bg-accent-500/25 disabled:opacity-50"
					>{isGenerating ? 'Creating…' : 'Create link'}</button
				>
			</div>
		</form>
	{/if}
</Modal>
