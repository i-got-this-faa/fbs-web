<script lang="ts">
	import { untrack } from 'svelte';
	import { getGrantsContext } from '$lib/stores/grants.svelte';
	import { getKeysContext } from '$lib/stores/keys.svelte';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Autocomplete from '$lib/components/Autocomplete.svelte';
	import type { BucketGrant, CreateBucketGrantRequest } from '$lib/types/api';
	import { ShieldIcon, UserIcon, Trash2Icon, AlertCircleIcon, SettingsIcon } from 'lucide-svelte';

	interface Props {
		bucketName: string;
		showCreateModal?: boolean;
	}

	let { bucketName, showCreateModal = $bindable(false) }: Props = $props();

	const grants = getGrantsContext();
	const keys = getKeysContext();
	const buckets = getBucketsContext();

	let isLoading = $state(true);
	let loadError = $state<string | null>(null);

	// Modals & Forms State
	interface GroupedGrant {
		id: string;
		granteeUserId: string;
		keyPrefix: string;
		note: string;
		isActive: boolean;
		grants: BucketGrant[];
	}

	let deleteGroupTarget = $state<GroupedGrant | null>(null);
	let deleteIndividualTarget = $state<BucketGrant | null>(null);
	let deleteError = $state<string | null>(null);
	let isDeleting = $state(false);

	$effect(() => {
		if (deleteGroupTarget !== null || deleteIndividualTarget !== null) {
			untrack(() => {
				deleteError = null;
				isDeleting = false;
			});
		}
	});

	$effect(() => {
		if (showCreateModal) {
			untrack(() => {
				createError = null;
				selectedActions = ['s3:GetObject', 's3:ListBucket'];
				keyPrefix = '';
				note = '';
				selectedKeyId = activeKeys[0]?.id ?? '';
			});
		}
	});

	let selectedKeyId = $state('');
	let selectedActions = $state<string[]>([]);
	let keyPrefix = $state('');
	let note = $state('');
	let createError = $state<string | null>(null);
	let isCreating = $state(false);

	let showTransferModal = $state(false);
	let transferSelectedKeyId = $state('');
	let transferError = $state<string | null>(null);
	let isTransferring = $state(false);

	$effect(() => {
		if (bucketName) {
			void loadData();
		}
	});

	async function loadData() {
		isLoading = true;
		loadError = null;
		quickAddErrors = {};
		try {
			// Load grants on the bucket
			await grants.load(bucketName);
			if (grants.error) {
				loadError = grants.error;
			}
			// Safely load access keys to map user IDs to display names in UI
			await keys.load().catch(() => {
				// Silently fail if user is not authorized to list keys
			});
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load permissions';
		} finally {
			isLoading = false;
		}
	}

	function resolveGranteeName(userId: string): string {
		const key = keys.items.find((k) => k.id === userId);
		if (key) {
			return key.displayName;
		}
		if (userId.length > 12) {
			return userId.slice(0, 8) + '...' + userId.slice(-4);
		}
		return userId;
	}

	// Filter active keys to list as potential grantees/new owners
	const activeKeys = $derived(keys.items.filter((k) => k.isActive));
	const ownerKey = $derived(keys.items.find((k) => k.id === buckets.selected?.ownerId));

	// Items for Autocomplete components
	const autocompleteItems = $derived(
		activeKeys.map((key) => ({
			id: key.id,
			label: `${key.accessKeyId} (${key.role})`,
			group: key.displayName
		}))
	);

	const transferAutocompleteItems = $derived(
		activeKeys.map((key) => ({
			id: key.id,
			label:
				key.id === buckets.selected?.ownerId
					? `${key.accessKeyId} (${key.role}) (Current Owner)`
					: `${key.accessKeyId} (${key.role})`,
			group: key.displayName,
			disabled: key.id === buckets.selected?.ownerId
		}))
	);

	// Group bucket grants by granteeUserId and keyPrefix
	const groupedGrants = $derived.by(() => {
		const groups: Record<string, BucketGrant[]> = {};
		for (const grant of grants.items) {
			const key = `${grant.granteeUserId}::${grant.keyPrefix || ''}`;
			if (!groups[key]) {
				groups[key] = [];
			}
			groups[key].push(grant);
		}

		return Object.entries(groups).map(([keyStr, items]) => {
			const parts = keyStr.split('::');
			const granteeUserId = parts[0];
			const keyPrefix = parts.slice(1).join('::');
			const isActive = items.every((item) => item.isActive);
			const notes = Array.from(new Set(items.map((item) => item.note).filter(Boolean)));
			const note = notes.join(', ') || '';

			return {
				id: keyStr,
				granteeUserId,
				keyPrefix,
				note,
				isActive,
				grants: items
			} satisfies GroupedGrant;
		});
	});

	const isForbidden = $derived(
		loadError?.toLowerCase().includes('forbidden') ||
			loadError?.toLowerCase().includes('unauthorized') ||
			loadError?.toLowerCase().includes('403')
	);

	const s3Actions = [
		{
			value: 's3:GetObject',
			label: 'Read Objects (s3:GetObject)',
			desc: 'Download object content and read metadata'
		},
		{
			value: 's3:ListBucket',
			label: 'List Objects (s3:ListBucket)',
			desc: 'List files/folders inside key prefix'
		},
		{
			value: 's3:PutObject',
			label: 'Write Objects (s3:PutObject)',
			desc: 'Upload, modify, or copy objects'
		},
		{
			value: 's3:DeleteObject',
			label: 'Delete Objects (s3:DeleteObject)',
			desc: 'Remove objects permanently'
		},
		{
			value: 's3:ListMultipartUploadParts',
			label: 'List Multipart (s3:ListMultipartUploadParts)',
			desc: 'View active multipart upload parts'
		},
		{
			value: 's3:AbortMultipartUpload',
			label: 'Abort Multipart (s3:AbortMultipartUpload)',
			desc: 'Cancel and clean up multipart uploads'
		}
	];

	async function handleCreate(e: Event) {
		e.preventDefault();
		createError = null;

		const granteeUserId = selectedKeyId;

		if (!granteeUserId) {
			createError = 'Grantee access key is required';
			return;
		}

		if (selectedActions.length === 0) {
			createError = 'At least one action must be selected';
			return;
		}

		const formattedPrefix = keyPrefix.trim();

		isCreating = true;
		const req: CreateBucketGrantRequest = {
			granteeUserId,
			actions: selectedActions,
			keyPrefix: formattedPrefix,
			note: note.trim() || undefined
		};

		const success = await grants.create(bucketName, req);
		isCreating = false;

		if (success) {
			showCreateModal = false;
		} else {
			createError = grants.error;
		}
	}

	async function handleDeleteGroup() {
		if (!deleteGroupTarget) return;
		deleteError = null;
		isDeleting = true;
		const targets = deleteGroupTarget.grants;
		try {
			const results = await Promise.all(
				targets.map((grant) => grants.remove(bucketName, grant.id))
			);
			if (results.every(Boolean)) {
				deleteGroupTarget = null;
			} else {
				deleteError = grants.error || 'Failed to remove some or all grants';
			}
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'An error occurred while deleting';
		} finally {
			isDeleting = false;
		}
	}

	async function handleDeleteIndividual() {
		if (!deleteIndividualTarget) return;
		deleteError = null;
		isDeleting = true;
		const target = deleteIndividualTarget;
		try {
			const success = await grants.remove(bucketName, target.id);
			if (success) {
				deleteIndividualTarget = null;
			} else {
				deleteError = grants.error || 'Failed to remove permission';
			}
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'An error occurred while deleting';
		} finally {
			isDeleting = false;
		}
	}

	let quickAddErrors = $state<Record<string, string | null>>({});

	const getAvailableActions = (group: GroupedGrant) => {
		return s3Actions.filter((action) => !group.grants.some((g) => g.action === action.value));
	};

	async function handleQuickAddAction(group: GroupedGrant, action: string) {
		if (!action) return;
		quickAddErrors[group.id] = null;

		const req: CreateBucketGrantRequest = {
			granteeUserId: group.granteeUserId,
			actions: [action],
			keyPrefix: group.keyPrefix,
			note: group.note || undefined
		};

		const success = await grants.create(bucketName, req);
		if (!success) {
			quickAddErrors[group.id] = grants.error;
		}
	}

	function openTransferModal() {
		showTransferModal = true;
		transferError = null;
		transferSelectedKeyId =
			activeKeys.find((k) => k.id !== buckets.selected?.ownerId)?.id ?? activeKeys[0]?.id ?? '';
	}

	async function handleTransfer(e: Event) {
		e.preventDefault();
		transferError = null;

		const newOwnerUserId = transferSelectedKeyId;

		if (!newOwnerUserId) {
			transferError = 'New owner access key is required';
			return;
		}

		if (newOwnerUserId === buckets.selected?.ownerId) {
			transferError = 'New owner must be different from current owner';
			return;
		}

		isTransferring = true;
		const success = await grants.transferOwnership(bucketName, newOwnerUserId);
		isTransferring = false;

		if (success) {
			showTransferModal = false;
		} else {
			transferError = grants.error;
		}
	}

	function toggleActionSelection(action: string) {
		if (selectedActions.includes(action)) {
			selectedActions = selectedActions.filter((a) => a !== action);
		} else {
			selectedActions = [...selectedActions, action];
		}
	}
</script>

<div
	class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-800 bg-surface-900"
>
	{#if isLoading}
		<LoadingSpinner label="Loading bucket permissions..." minHeight="14rem" />
	{:else if isForbidden}
		<div class="m-6 rounded-xl border border-danger-500/20 bg-danger-500/5 p-6 text-center">
			<ShieldIcon class="mx-auto mb-3 h-8 w-8 text-danger-400" />
			<h3 class="text-sm font-semibold text-danger-300">Access Denied</h3>
			<p class="mx-auto mt-2 max-w-md text-xs text-surface-400">
				You do not have permission to manage permissions for bucket <strong>{bucketName}</strong>.
				Only the bucket owner or an administrator can view and modify sharing grants.
			</p>
		</div>
	{:else if loadError}
		<div
			class="m-6 flex items-center gap-3 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400"
		>
			<AlertCircleIcon class="h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">Failed to load permissions</p>
				<p class="text-xs text-surface-500">{loadError}</p>
			</div>
		</div>
	{:else}
		<!-- Card Header with Bucket Owner Info -->
		<div class="flex h-12 shrink-0 items-center justify-between border-b border-surface-800 px-4">
			<div>
				<h2 class="text-base font-semibold text-surface-200">Sharing & Access Grants</h2>
			</div>
			<div class="flex items-center gap-2 text-xs">
				<div
					class="flex items-center gap-1.5 rounded-lg border border-surface-800 bg-surface-950 px-3 py-1.5 text-[11px] text-surface-300"
				>
					<UserIcon size={12} class="font-mono text-accent-400" />
					<span class="text-surface-500">Owner:</span>
					<span class="font-semibold text-surface-200">
						{#if ownerKey}
							{ownerKey.displayName}
						{:else if buckets.selected?.ownerId}
							{buckets.selected.ownerId.slice(0, 8)}...{buckets.selected.ownerId.slice(-4)}
						{:else}
							Unknown Owner
						{/if}
					</span>
				</div>
				<button
					onclick={openTransferModal}
					class="rounded-lg border border-surface-800 bg-surface-850/50 px-3 py-1.5 text-[11px] font-semibold text-surface-300 transition-colors hover:bg-surface-800"
				>
					<SettingsIcon size={12} class="mr-1 inline text-surface-400" />
					Transfer
				</button>
			</div>
		</div>

		{#if groupedGrants.length === 0}
			<div class="flex flex-1 flex-col items-center justify-center py-12 text-center">
				<ShieldIcon class="text-surface-650 mx-auto mb-2.5 h-7 w-7" />
				<p class="text-xs font-medium text-surface-400">No active grants</p>
				<p class="mt-1 text-[11px] text-surface-600">
					This bucket is currently private. Click "Add Grant" to share access.
				</p>
			</div>
		{:else}
			<div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
				{#each groupedGrants as group (group.id)}
					<div
						class="rounded-xl border border-surface-800 bg-surface-950/20 p-4 transition-all duration-150 hover:border-surface-700"
					>
						<!-- Header -->
						<div class="flex items-start justify-between border-b border-surface-800/50 pb-3">
							<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
								<div class="flex items-center gap-2">
									<UserIcon size={14} class="text-accent-400" />
									<span class="text-sm font-semibold text-surface-100">
										{resolveGranteeName(group.granteeUserId)}
									</span>
								</div>
								<span class="text-xs text-surface-700 select-none">•</span>
								<div class="flex items-center gap-1.5 text-xs text-surface-400">
									<span class="text-surface-500">Folder prefix:</span>
									{#if group.keyPrefix}
										<code
											class="rounded border border-surface-850 bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] font-medium text-accent-400"
										>
											{group.keyPrefix}
										</code>
									{:else}
										<span class="text-surface-650 font-medium italic">Entire Bucket</span>
									{/if}
								</div>
								{#if group.note}
									<span class="text-xs text-surface-700 select-none">•</span>
									<div class="flex items-center gap-1.5 text-xs text-surface-400">
										<span class="text-surface-500">Note:</span>
										<span class="font-medium text-surface-300">{group.note}</span>
									</div>
								{/if}
							</div>
							<button
								onclick={() => (deleteGroupTarget = group)}
								class="rounded-lg p-1.5 text-surface-500 transition-colors hover:bg-danger-500/10 hover:text-danger-400"
								title="Remove all permissions for this grantee"
							>
								<Trash2Icon size={14} />
							</button>
						</div>

						<!-- Granted Actions -->
						<div class="mt-3.5">
							<div class="flex flex-wrap gap-2">
								{#each group.grants as grant (grant.id)}
									<div
										class="group/action flex w-[220px] items-center justify-between rounded-lg border border-surface-800 bg-surface-900/40 py-1.5 pr-1.5 pl-3 transition-all duration-150 hover:border-accent-500/20 hover:bg-surface-900"
									>
										<code class="font-mono text-xs font-semibold text-accent-400">
											{grant.action.replace('s3:', '')}
										</code>
										<button
											type="button"
											onclick={() => (deleteIndividualTarget = grant)}
											class="rounded p-0.5 text-surface-500 opacity-0 transition-all duration-150 group-hover/action:opacity-100 hover:bg-danger-500/10 hover:text-danger-400 focus:opacity-100"
											title="Revoke this action"
										>
											<Trash2Icon size={12} />
										</button>
									</div>
								{/each}

								{#if getAvailableActions(group).length > 0}
									<div class="relative w-[220px]">
										<select
											value=""
											onchange={(e) => handleQuickAddAction(group, e.currentTarget.value)}
											class="w-full cursor-pointer appearance-none rounded-lg border border-surface-700 bg-surface-800 py-1.5 pr-8 pl-3 text-xs font-semibold text-surface-100 transition-colors outline-none hover:border-surface-600 focus:border-accent-500"
										>
											<option value="" disabled selected>+ Add Permission</option>
											{#each getAvailableActions(group) as action (action.value)}
												<option value={action.value} class="bg-surface-900 text-surface-100">
													{action.value.replace('s3:', '')}
												</option>
											{/each}
										</select>
										<div
											class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[8px] text-surface-400"
										>
											▼
										</div>
									</div>
								{/if}
							</div>

							{#if quickAddErrors[group.id]}
								<p class="mt-2 text-xs font-medium text-danger-400">
									Failed to add action: {quickAddErrors[group.id]}
								</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Modal: Add Grant -->
<Modal
	open={showCreateModal}
	title="Create Sharing Grant"
	onclose={() => (showCreateModal = false)}
>
	<form onsubmit={handleCreate} class="space-y-4">
		<div>
			<label for="grantee-key" class="mb-1 block text-xs font-medium text-surface-400">
				Select Access Key
			</label>
			<Autocomplete
				id="grantee-key"
				bind:value={selectedKeyId}
				items={autocompleteItems}
				placeholder="Select or search access key..."
				allowCustom={true}
			/>
		</div>

		<!-- Actions -->
		<div>
			<span class="mb-1.5 block text-xs font-medium text-surface-400">Actions</span>
			<div
				class="max-h-[160px] space-y-1.5 overflow-y-auto rounded-lg border border-surface-800 bg-surface-950 p-2.5"
			>
				{#each s3Actions as action (action.value)}
					<label class="flex cursor-pointer items-start gap-2.5 rounded p-1 hover:bg-surface-900">
						<input
							type="checkbox"
							checked={selectedActions.includes(action.value)}
							onchange={() => toggleActionSelection(action.value)}
							class="border-surface-750 mt-0.5 rounded bg-surface-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-surface-950"
						/>
						<div>
							<span class="block text-xs font-medium text-surface-200">{action.label}</span>
							<span class="block text-[10px] leading-tight text-surface-500">{action.desc}</span>
						</div>
					</label>
				{/each}
			</div>
		</div>

		<!-- Key Prefix -->
		<div>
			<label for="key-prefix" class="mb-1 block text-xs font-medium text-surface-400">
				Key Prefix (Optional)
			</label>
			<input
				id="key-prefix"
				type="text"
				bind:value={keyPrefix}
				placeholder="e.g. images/ (leave blank for entire bucket)"
				class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 font-mono text-xs text-surface-100 outline-none focus:border-accent-500"
			/>
			<span class="mt-1 block text-[10px] text-surface-500">
				Folder paths must end with a slash '/'. S3 operations must match this prefix.
			</span>
		</div>

		<!-- Note -->
		<div>
			<label for="grant-note" class="mb-1 block text-xs font-medium text-surface-400">
				Note / Label (Optional)
			</label>
			<input
				id="grant-note"
				type="text"
				bind:value={note}
				placeholder="e.g. CI pipeline uploader"
				class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-surface-100 outline-none focus:border-accent-500"
			/>
		</div>

		{#if createError}
			<p
				class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-xs text-danger-400"
			>
				{createError}
			</p>
		{/if}

		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={() => (showCreateModal = false)}
				class="rounded-lg border border-surface-800 px-4 py-2 text-xs font-semibold text-surface-400 transition-colors hover:bg-surface-850 hover:text-surface-200"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={isCreating}
				class="rounded-lg bg-accent-500/15 px-4 py-2 text-xs font-semibold text-accent-400 transition-colors hover:bg-accent-500/25 disabled:opacity-50"
			>
				{isCreating ? 'Creating...' : 'Create Grants'}
			</button>
		</div>
	</form>
</Modal>

<!-- Modal: Transfer Ownership -->
<Modal
	open={showTransferModal}
	title="Transfer Bucket Ownership"
	description="Assign a different user as the owner of this bucket. You may lose access to manage sharing settings."
	onclose={() => (showTransferModal = false)}
>
	<form onsubmit={handleTransfer} class="space-y-4">
		<div>
			<label for="transfer-key" class="mb-1 block text-xs font-medium text-surface-400">
				Select Access Key
			</label>
			<Autocomplete
				id="transfer-key"
				bind:value={transferSelectedKeyId}
				items={transferAutocompleteItems}
				placeholder="Select or search access key..."
				allowCustom={true}
			/>
		</div>

		{#if transferError}
			<p
				class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-xs text-danger-400"
			>
				{transferError}
			</p>
		{/if}

		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={() => (showTransferModal = false)}
				class="rounded-lg border border-surface-800 px-4 py-2 text-xs font-semibold text-surface-400 transition-colors hover:bg-surface-850 hover:text-surface-200"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={isTransferring}
				class="rounded-lg bg-danger-500/15 px-4 py-2 text-xs font-semibold text-danger-400 transition-colors hover:bg-danger-500/25 disabled:opacity-50"
			>
				{isTransferring ? 'Transferring...' : 'Transfer Ownership'}
			</button>
		</div>
	</form>
</Modal>

<ConfirmDialog
	open={deleteGroupTarget !== null}
	title="Remove Sharing Grant Group"
	description="Are you sure you want to remove all sharing grants for this grantee and prefix? The grantee will immediately lose all associated permissions."
	confirmLabel="Remove Group"
	destructive
	error={deleteError}
	loading={isDeleting}
	onconfirm={handleDeleteGroup}
	oncancel={() => (deleteGroupTarget = null)}
/>

<ConfirmDialog
	open={deleteIndividualTarget !== null}
	title="Remove Permission"
	description="Are you sure you want to remove this specific permission? The grantee will lose this action immediately."
	confirmLabel="Remove Permission"
	destructive
	error={deleteError}
	loading={isDeleting}
	onconfirm={handleDeleteIndividual}
	oncancel={() => (deleteIndividualTarget = null)}
/>
