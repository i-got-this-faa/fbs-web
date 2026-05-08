<script lang="ts">
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { getKeysContext } from '$lib/stores/keys.svelte';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';
	import type { CreateKeyRequest } from '$lib/types/api';
	import { formatDate } from '$lib/utils/format';
	import { onDestroy, onMount } from 'svelte';

	type CopyTarget = 'bearer' | 'access' | 'secret';

	const keys = getKeysContext();
	const pageActions = getPageActionsContext();

	let showCreateForm = $state(false);
	let displayName = $state('');
	let role = $state<CreateKeyRequest['role']>('member');
	let createError = $state<string | null>(null);
	let deleteTarget = $state<string | null>(null);
	let copiedTarget = $state<CopyTarget | null>(null);

	onMount(() => {
		keys.load();
		pageActions.setActions(topBarActions);
	});

	onDestroy(() => {
		pageActions.clearActions();
	});

	async function handleCreate(e: Event) {
		e.preventDefault();
		createError = null;

		const trimmedDisplayName = displayName.trim();
		if (!trimmedDisplayName) {
			createError = 'Display name is required';
			return;
		}

		const success = await keys.create({ displayName: trimmedDisplayName, role });
		if (success) {
			displayName = '';
			role = 'member';
			showCreateForm = false;
		} else {
			createError = keys.error;
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		await keys.remove(deleteTarget);
		deleteTarget = null;
	}

	async function copyValue(value: string, target: CopyTarget) {
		await navigator.clipboard.writeText(value);
		copiedTarget = target;
		setTimeout(() => {
			if (copiedTarget === target) copiedTarget = null;
		}, 1600);
	}
</script>

{#snippet topBarActions()}
	<button
		onclick={() => {
			showCreateForm = !showCreateForm;
			createError = null;
			displayName = '';
			role = 'member';
		}}
		class="rounded-lg bg-accent-500/15 px-3.5 py-1.5 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
	>
		{showCreateForm ? 'Cancel' : '+ Create Key'}
	</button>
{/snippet}

<svelte:head><title>Access Keys — FBS</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	{#if keys.lastCreatedSecret}
		<div class="rounded-xl border border-warning-500/20 bg-warning-500/5 p-5">
			<div class="mb-4 flex items-start justify-between gap-4">
				<div>
					<h2 class="text-sm font-semibold text-warning-300">New Credentials</h2>
					<p class="mt-1 text-xs text-surface-500">
						Save these values now. fbs-core will not return the secrets again.
					</p>
				</div>
				<button
					onclick={() => keys.dismissSecret()}
					class="rounded-md px-2 py-1 text-xs text-surface-500 hover:bg-surface-800 hover:text-surface-300"
				>
					Dismiss
				</button>
			</div>

			<div class="space-y-3">
				<div>
					<div class="mb-1 flex items-center justify-between gap-2">
						<span class="text-xs font-medium text-surface-400">Bearer Token</span>
						<button
							onclick={() => copyValue(keys.lastCreatedSecret?.bearerToken ?? '', 'bearer')}
							class="rounded bg-surface-800 px-2 py-1 text-xs text-surface-300 hover:bg-surface-700"
						>
							{copiedTarget === 'bearer' ? 'Copied' : 'Copy'}
						</button>
					</div>
					<code
						class="block rounded-lg border border-surface-800 bg-surface-950 px-3 py-2 text-xs break-all text-surface-300"
					>
						{keys.lastCreatedSecret.bearerToken}
					</code>
				</div>

				<div class="grid gap-3 md:grid-cols-2">
					<div>
						<div class="mb-1 flex items-center justify-between gap-2">
							<span class="text-xs font-medium text-surface-400">SigV4 Access Key</span>
							<button
								onclick={() => copyValue(keys.lastCreatedSecret?.sigV4.accessKeyId ?? '', 'access')}
								class="rounded bg-surface-800 px-2 py-1 text-xs text-surface-300 hover:bg-surface-700"
							>
								{copiedTarget === 'access' ? 'Copied' : 'Copy'}
							</button>
						</div>
						<code
							class="block rounded-lg border border-surface-800 bg-surface-950 px-3 py-2 text-xs break-all text-surface-300"
						>
							{keys.lastCreatedSecret.sigV4.accessKeyId}
						</code>
					</div>
					<div>
						<div class="mb-1 flex items-center justify-between gap-2">
							<span class="text-xs font-medium text-surface-400">SigV4 Secret Key</span>
							<button
								onclick={() => copyValue(keys.lastCreatedSecret?.sigV4.secretKey ?? '', 'secret')}
								class="rounded bg-surface-800 px-2 py-1 text-xs text-surface-300 hover:bg-surface-700"
							>
								{copiedTarget === 'secret' ? 'Copied' : 'Copy'}
							</button>
						</div>
						<code
							class="block rounded-lg border border-surface-800 bg-surface-950 px-3 py-2 text-xs break-all text-surface-300"
						>
							{keys.lastCreatedSecret.sigV4.secretKey}
						</code>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if showCreateForm}
		<form onsubmit={handleCreate} class="rounded-xl border border-surface-800 bg-surface-900 p-5">
			<h2 class="mb-4 text-sm font-semibold text-surface-200">Create Access Key</h2>
			<div class="grid gap-3 md:grid-cols-[1fr_160px_auto]">
				<input
					type="text"
					bind:value={displayName}
					placeholder="Service or person name"
					required
					class="rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 placeholder-surface-600 outline-none focus:border-accent-500"
				/>
				<select
					bind:value={role}
					class="rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
				>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
				<button
					type="submit"
					class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
				>
					Create
				</button>
			</div>
			{#if createError}
				<p class="mt-2 text-xs text-danger-400">{createError}</p>
			{/if}
		</form>
	{/if}

	{#if keys.error && !createError}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{keys.error}
		</div>
	{/if}

	{#if keys.isLoading}
		<div class="rounded-xl border border-surface-800 bg-surface-900">
			<LoadingSpinner label="Loading keys..." minHeight="12rem" />
		</div>
	{:else if keys.items.length === 0}
		<EmptyState
			icon="🔑"
			title="No access keys"
			description="Create an access key for API clients."
		>
			{#snippet action()}
				<button
					onclick={() => (showCreateForm = true)}
					class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
				>
					Create Key
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-surface-800 bg-surface-900">
			<div class="min-w-[680px]">
				<div
					class="grid grid-cols-[1fr_130px_120px_120px_44px] items-center gap-3 border-b border-surface-800 px-4 py-2.5 text-xs font-medium text-surface-500 uppercase"
				>
					<span>Name</span>
					<span>Role</span>
					<span>Status</span>
					<span class="text-right">Created</span>
					<span></span>
				</div>
				{#each keys.items as key (key.id)}
					<div
						class="group grid grid-cols-[1fr_130px_120px_120px_44px] items-center gap-3 border-b border-surface-800/50 px-4 py-3 hover:bg-surface-850"
					>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-surface-200">{key.displayName}</p>
							<p class="truncate text-xs text-surface-600">{key.sigV4AccessKeyId}</p>
						</div>
						<span class="text-sm text-surface-400 capitalize">{key.role}</span>
						<StatusBadge status={key.isActive ? 'active' : 'inactive'} />
						<span class="text-right text-xs text-surface-500">{formatDate(key.createdAt)}</span>
						<div class="flex justify-end">
							<button
								onclick={() => (deleteTarget = key.id)}
								class="rounded-md p-1.5 text-surface-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-danger-500/10 hover:text-danger-400"
								aria-label="Delete {key.displayName}"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M3 6h18" />
									<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
									<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete Access Key"
	description="Delete this key permanently? Existing clients using it will stop authenticating."
	confirmLabel="Delete"
	destructive
	onconfirm={handleDelete}
	oncancel={() => (deleteTarget = null)}
/>
