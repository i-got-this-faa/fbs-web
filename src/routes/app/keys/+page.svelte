<script lang="ts">
	import { getKeysContext } from '$lib/stores/keys.svelte';
	import { formatDate } from '$lib/utils/format';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { onMount } from 'svelte';

	const keys = getKeysContext();

	let showCreateForm = $state(false);
	let newKeyName = $state('');
	let newKeyRole = $state<'admin' | 'member'>('member');
	let deleteTarget = $state<string | null>(null);
	let copiedSecret = $state(false);

	onMount(() => {
		keys.load();
	});

	async function handleCreate(e: Event) {
		e.preventDefault();
		const success = await keys.create({ displayName: newKeyName.trim(), role: newKeyRole });
		if (success) {
			newKeyName = '';
			showCreateForm = false;
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		await keys.remove(deleteTarget);
		deleteTarget = null;
	}

	function copySecret(secret: string) {
		navigator.clipboard.writeText(secret);
		copiedSecret = true;
		setTimeout(() => (copiedSecret = false), 2000);
	}
</script>

<svelte:head><title>Access Keys — FBS</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold text-surface-100">Access Keys</h1>
			<p class="mt-0.5 text-sm text-surface-500">
				{keys.activeCount} active · {keys.items.length} total
			</p>
		</div>
		<button
			onclick={() => {
				showCreateForm = !showCreateForm;
				newKeyName = '';
			}}
			class="rounded-lg bg-accent-500/15 px-3.5 py-2 text-sm font-medium text-accent-400 hover:bg-accent-500/25"
		>
			{showCreateForm ? 'Cancel' : '+ Create Key'}
		</button>
	</div>

	<!-- One-time secret display -->
	{#if keys.lastCreatedSecret}
		<div class="rounded-xl border border-warning-500/30 bg-warning-500/5 p-5">
			<div class="mb-2 flex items-center gap-2">
				<span class="text-sm font-semibold text-warning-400">⚠ Save your secret key</span>
			</div>
			<p class="mb-3 text-xs text-surface-400">
				This is the only time your secret access key will be shown. Copy it now.
			</p>
			<div class="space-y-2">
				<div class="flex items-center justify-between rounded-lg bg-surface-800 px-3 py-2">
					<div>
						<p class="text-xs text-surface-500">Access Key ID</p>
						<code class="text-sm text-surface-200">{keys.lastCreatedSecret.key.accessKeyId}</code>
					</div>
				</div>
				<div class="flex items-center justify-between rounded-lg bg-surface-800 px-3 py-2">
					<div>
						<p class="text-xs text-surface-500">Secret Access Key</p>
						<code class="text-sm text-surface-200">{keys.lastCreatedSecret.secretAccessKey}</code>
					</div>
					<button
						onclick={() => copySecret(keys.lastCreatedSecret!.secretAccessKey)}
						class="rounded-md px-2 py-1 text-xs font-medium text-accent-400 hover:bg-accent-500/15"
					>
						{copiedSecret ? '✓ Copied' : 'Copy'}
					</button>
				</div>
			</div>
			<button
				onclick={() => keys.dismissSecret()}
				class="mt-3 text-xs font-medium text-surface-500 hover:text-surface-300">Dismiss</button
			>
		</div>
	{/if}

	{#if showCreateForm}
		<form onsubmit={handleCreate} class="rounded-xl border border-surface-800 bg-surface-900 p-5">
			<h2 class="mb-3 text-sm font-semibold text-surface-200">New Access Key</h2>
			<div class="flex gap-3">
				<input
					type="text"
					bind:value={newKeyName}
					placeholder="Display name"
					required
					class="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 placeholder-surface-600 outline-none focus:border-accent-500"
				/>
				<select
					bind:value={newKeyRole}
					class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 outline-none focus:border-accent-500"
				>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
				<button
					type="submit"
					class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 hover:bg-accent-500/25"
					>Create</button
				>
			</div>
			{#if keys.error}<p class="mt-2 text-xs text-danger-400">{keys.error}</p>{/if}
		</form>
	{/if}

	{#if keys.isLoading}
		<div class="space-y-2">
			{#each Array.from({ length: 3 }, (_, i) => i) as i (i)}<div
					class="h-16 animate-pulse rounded-xl border border-surface-800 bg-surface-900"
				></div>{/each}
		</div>
	{:else if keys.items.length === 0}
		<EmptyState
			icon="🔑"
			title="No access keys"
			description="Create your first access key for S3 API authentication."
		>
			{#snippet action()}<button
					onclick={() => (showCreateForm = true)}
					class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 hover:bg-accent-500/25"
					>Create Key</button
				>{/snippet}
		</EmptyState>
	{:else}
		<div class="overflow-hidden rounded-xl border border-surface-800 bg-surface-900">
			<div
				class="grid grid-cols-[1fr_140px_80px_80px_40px] gap-3 border-b border-surface-800 px-4 py-2.5 text-xs font-medium text-surface-500 uppercase"
			>
				<span>Name</span><span>Access Key ID</span><span>Role</span><span>Status</span><span></span>
			</div>
			{#each keys.items as key (key.id)}
				<div
					class="group grid grid-cols-[1fr_140px_80px_80px_40px] items-center gap-3 border-b border-surface-800/50 px-4 py-3 hover:bg-surface-850"
				>
					<div>
						<p class="text-sm font-medium text-surface-200">{key.displayName}</p>
						<p class="text-xs text-surface-600">Created {formatDate(key.createdAt)}</p>
					</div>
					<code class="truncate text-xs text-surface-400">{key.accessKeyId}</code>
					<span class="text-xs text-surface-400 capitalize">{key.role}</span>
					<button onclick={() => keys.toggleActive(key.id, !key.isActive)}>
						<StatusBadge status={key.isActive ? 'active' : 'inactive'} />
					</button>
					<div class="flex justify-end">
						<button
							onclick={() => (deleteTarget = key.id)}
							class="rounded-md p-1 text-surface-600 opacity-0 group-hover:opacity-100 hover:text-danger-400"
							aria-label="Delete key"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
									d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
								/></svg
							>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Revoke Access Key"
	description="This key will be permanently revoked. Any services using it will lose access."
	confirmLabel="Revoke Key"
	destructive
	onconfirm={handleDelete}
	oncancel={() => (deleteTarget = null)}
/>
