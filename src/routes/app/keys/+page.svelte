<script lang="ts">
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import { getKeysContext } from '$lib/stores/keys.svelte';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';
	import type { AccessKey, CreateKeyRequest } from '$lib/types/api';
	import { formatDate } from '$lib/utils/format';
	import { onDestroy, onMount } from 'svelte';

	type CopyTarget = 'bearer' | 'access' | 'secret';

	const keys = getKeysContext();
	const pageActions = getPageActionsContext();
	const connection = getConnectionContext();
	const currentAccessKeyId = $derived(connection.token.split('.')[0] ?? '');

	let showCreateModal = $state(false);
	let displayName = $state('');
	let role = $state<CreateKeyRequest['role']>('member');
	let createError = $state<string | null>(null);
	let deleteTarget = $state<string | null>(null);
	let deactivateTarget = $state<AccessKey | null>(null);
	let renameTarget = $state<AccessKey | null>(null);
	let renameDisplayName = $state('');
	let renameError = $state<string | null>(null);
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
			showCreateModal = false;
		} else {
			createError = keys.error;
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		await keys.remove(deleteTarget);
		deleteTarget = null;
	}

	async function handleDeactivate() {
		if (!deactivateTarget) return;
		await keys.toggleActive(deactivateTarget.id, false);
		deactivateTarget = null;
	}

	async function handleToggleActive(key: AccessKey) {
		if (key.isActive) {
			deactivateTarget = key;
			return;
		}

		await keys.toggleActive(key.id, true);
	}

	async function handleRename(event: Event) {
		event.preventDefault();
		if (!renameTarget) return;

		const trimmedName = renameDisplayName.trim();
		if (!trimmedName) {
			renameError = 'Display name is required';
			return;
		}

		const success = await keys.rename(renameTarget.id, trimmedName);
		if (success) {
			closeRenameModal();
		} else {
			renameError = keys.error;
		}
	}

	async function copyValue(value: string, target: CopyTarget) {
		await navigator.clipboard.writeText(value);
		copiedTarget = target;
		setTimeout(() => {
			if (copiedTarget === target) copiedTarget = null;
		}, 1600);
	}

	function openCreateModal() {
		showCreateModal = true;
		createError = null;
		displayName = '';
		role = 'member';
	}

	function closeCreateModal() {
		showCreateModal = false;
		createError = null;
		displayName = '';
		role = 'member';
	}

	function openRenameModal(key: AccessKey) {
		renameTarget = key;
		renameDisplayName = key.displayName;
		renameError = null;
	}

	function closeRenameModal() {
		renameTarget = null;
		renameDisplayName = '';
		renameError = null;
	}
</script>

{#snippet topBarActions()}
	<button
		onclick={openCreateModal}
		class="rounded-lg bg-accent-500/15 px-3.5 py-1.5 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
	>
		+ Create Key
	</button>
{/snippet}

<svelte:head><title>Access Keys — FBS</title></svelte:head>

<!-- Full-height shell: page never scrolls; keys table fills remaining space then scrolls -->
<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
	{#if keys.lastCreatedSecret}
		<div class="shrink-0 rounded-xl border border-warning-500/20 bg-warning-500/5 p-5">
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

	{#if keys.error && !createError}
		<div
			class="shrink-0 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400"
		>
			{keys.error}
		</div>
	{/if}

	<div
		class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-800 bg-surface-900"
	>
		{#if keys.isLoading}
			<LoadingSpinner label="Loading keys..." minHeight="12rem" />
		{:else if keys.items.length === 0}
			<div class="p-6">
				<EmptyState
					icon="🔑"
					title="No access keys"
					description="Create an access key for API clients."
				>
					{#snippet action()}
						<button
							onclick={openCreateModal}
							class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
						>
							Create Key
						</button>
					{/snippet}
				</EmptyState>
			</div>
		{:else}
			<div class="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
				<div class="min-w-[680px]">
					<div
						class="sticky top-0 z-10 grid grid-cols-[1fr_110px_110px_110px_150px] items-center gap-3 border-b border-surface-800 bg-surface-900 px-4 py-2.5 text-xs font-medium text-surface-500 uppercase"
					>
						<span>Name</span>
						<span>Role</span>
						<span>Status</span>
						<span class="text-right">Created</span>
						<span class="text-right">Actions</span>
					</div>
					{#each keys.items as key (key.id)}
						<div
							class="group grid grid-cols-[1fr_110px_110px_110px_150px] items-center gap-3 border-b border-surface-800/50 px-4 py-3 hover:bg-surface-850"
						>
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-surface-200">{key.displayName}</p>
								<p class="truncate text-xs text-surface-600">{key.sigV4AccessKeyId}</p>
							</div>
							<span class="text-sm text-surface-400 capitalize">{key.role}</span>
							<StatusBadge status={key.isActive ? 'active' : 'inactive'} />
							<span class="text-right text-xs text-surface-500">{formatDate(key.createdAt)}</span>
							<div class="flex justify-end gap-1">
								<button
									onclick={() => openRenameModal(key)}
									class="rounded-md px-2 py-1 text-xs text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-200"
								>
									Edit
								</button>
								<button
									onclick={() => handleToggleActive(key)}
									class="rounded-md px-2 py-1 text-xs text-surface-500 transition-colors hover:bg-surface-800 hover:text-surface-200"
								>
									{key.isActive ? 'Deactivate' : 'Activate'}
								</button>
								<button
									onclick={() => (deleteTarget = key.id)}
									class="rounded-md p-1.5 text-surface-600 transition-all hover:bg-danger-500/10 hover:text-danger-400"
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
</div>

<Modal
	open={showCreateModal}
	title="Create Access Key"
	description="Generate a bearer token and SigV4 credentials for an API client."
	onclose={closeCreateModal}
>
	<form onsubmit={handleCreate} class="space-y-4">
		<div>
			<label for="display-name" class="mb-1.5 block text-sm font-medium text-surface-300">
				Display name
			</label>
			<input
				id="display-name"
				type="text"
				bind:value={displayName}
				placeholder="Service or person name"
				required
				class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 placeholder-surface-600 outline-none focus:border-accent-500"
			/>
		</div>

		<div>
			<label for="key-role" class="mb-1.5 block text-sm font-medium text-surface-300">Role</label>
			<select
				id="key-role"
				bind:value={role}
				class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
			>
				<option value="member">Member</option>
				<option value="admin">Admin</option>
			</select>
		</div>

		{#if createError}
			<p
				class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-sm text-danger-400"
			>
				{createError}
			</p>
		{/if}

		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={closeCreateModal}
				class="rounded-lg px-4 py-2 text-sm font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
			>
				Cancel
			</button>
			<button
				type="submit"
				class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
			>
				Create Key
			</button>
		</div>
	</form>
</Modal>

<Modal open={renameTarget !== null} title="Rename Key" onclose={closeRenameModal}>
	<form onsubmit={handleRename} class="space-y-4">
		<div>
			<label for="rename-display-name" class="mb-1.5 block text-sm font-medium text-surface-300">
				Display name
			</label>
			<input
				id="rename-display-name"
				type="text"
				bind:value={renameDisplayName}
				required
				class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
			/>
		</div>

		{#if renameError}
			<p
				class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-sm text-danger-400"
			>
				{renameError}
			</p>
		{/if}

		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={closeRenameModal}
				class="rounded-lg px-4 py-2 text-sm font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
			>
				Cancel
			</button>
			<button
				type="submit"
				class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
			>
				Rename Key
			</button>
		</div>
	</form>
</Modal>

<ConfirmDialog
	open={deactivateTarget !== null}
	title="Deactivate Access Key"
	description={deactivateTarget?.accessKeyId === currentAccessKeyId
		? 'Clients using this key will stop authenticating. This appears to be your current dashboard key. You may be disconnected after deactivation.'
		: 'Clients using this key will stop authenticating.'}
	confirmLabel="Deactivate"
	destructive
	onconfirm={handleDeactivate}
	oncancel={() => (deactivateTarget = null)}
/>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete Access Key"
	description="Delete this key permanently? Existing clients using it will stop authenticating."
	confirmLabel="Delete"
	destructive
	onconfirm={handleDelete}
	oncancel={() => (deleteTarget = null)}
/>
