<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { getShareLinksContext } from '$lib/stores/share-links.svelte';
	import type { ShareLink } from '$lib/types/api';
	import { formatDate } from '$lib/utils/format';

	const { bucketName }: { bucketName: string } = $props();
	const links = getShareLinksContext();
	let revokeTarget = $state<ShareLink | null>(null);
	let isRevoking = $state(false);
	let error = $state<string | null>(null);
	let copiedCode = $state<string | null>(null);
	let now = $state(Date.now());
	const items = $derived(links.items.filter((link) => link.bucket === bucketName));
	onMount(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 60_000);
		return () => clearInterval(timer);
	});
	$effect(() => {
		const bucket = bucketName;
		untrack(() => {
			void links.load(bucket);
		});
	});

	async function copy(link: ShareLink) {
		try {
			await navigator.clipboard.writeText(link.url);
			copiedCode = link.code;
			error = null;
		} catch {
			error = 'Clipboard unavailable. Select and copy the URL from the list.';
		}
	}

	async function revoke() {
		if (!revokeTarget || isRevoking) return;
		isRevoking = true;
		error = null;
		try {
			await links.remove(revokeTarget.code);
			revokeTarget = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to revoke link';
		} finally {
			isRevoking = false;
		}
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
	<div class="flex items-start justify-between gap-3">
		<p class="text-sm text-surface-400">
			Create links from an object’s Share action. Links follow the current content at that key.
		</p>
		<button
			onclick={() => links.load(bucketName)}
			disabled={links.isLoading}
			class="rounded-lg bg-surface-800 px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 disabled:opacity-50"
			>Refresh links</button
		>
	</div>
	{#if links.error}<p role="alert" class="text-sm text-danger-400">{links.error}</p>{/if}
	{#if error}<p role="alert" class="text-sm text-danger-400">{error}</p>{/if}
	{#if links.isLoading && !items.length}
		<LoadingSpinner label="Loading share links..." />
	{:else if !items.length && !links.error}
		<EmptyState
			title="No share links"
			description="Share an object to create a short, revocable link."
		/>
	{:else}
		<div class="min-h-0 overflow-y-auto rounded-xl border border-surface-800 bg-surface-900">
			{#each items as link (link.code)}
				<div class="space-y-2 border-b border-surface-800 p-4 last:border-b-0">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium break-all text-surface-200">{link.key}</p>
							<p class="mt-1 text-xs text-surface-400">
								{link.expiresAt
									? `${Date.parse(link.expiresAt) <= now ? 'Expired' : 'Expires'} ${formatDate(link.expiresAt)}`
									: 'Never expires'} · Created {formatDate(link.createdAt)}
							</p>
						</div>
						<div class="flex gap-2">
							<button
								onclick={() => copy(link)}
								class="rounded-lg bg-accent-500/15 px-3 py-1.5 text-xs text-accent-400"
								>{copiedCode === link.code ? 'Copied!' : 'Copy'}</button
							>
							<button
								onclick={() => {
									error = null;
									revokeTarget = link;
								}}
								class="rounded-lg bg-danger-500/15 px-3 py-1.5 text-xs text-danger-400"
								>Revoke</button
							>
						</div>
					</div>
					<input
						readonly
						aria-label={`URL for ${link.code}`}
						value={link.url}
						class="w-full rounded-lg border border-surface-800 bg-surface-950 px-3 py-2 text-xs text-surface-400"
					/>
				</div>
			{/each}
		</div>
	{/if}
	<p class="text-xs text-surface-500">
		Deleting an object makes its links return 404; deleting the bucket removes them. Deactivating or
		deleting the creator disables their links. Media already copied by another service may remain
		visible after revocation.
	</p>
</div>

<ConfirmDialog
	open={revokeTarget !== null}
	title="Revoke share link"
	description={`Revoke ${revokeTarget?.code ?? ''}? This URL will stop serving the object.`}
	confirmLabel="Revoke link"
	destructive
	loading={isRevoking}
	{error}
	onconfirm={revoke}
	oncancel={() => {
		if (!isRevoking) revokeTarget = null;
	}}
/>
