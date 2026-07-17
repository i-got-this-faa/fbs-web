<script lang="ts">
	import { onMount } from 'svelte';
	import { getGrantsContext } from '$lib/stores/grants.svelte';
	import { getKeysContext } from '$lib/stores/keys.svelte';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { BucketGrant, CreateBucketGrantRequest } from '$lib/types/api';
	import {
		ShieldIcon,
		UserIcon,
		Trash2Icon,
		PlusIcon,
		AlertCircleIcon,
		SettingsIcon
	} from 'lucide-svelte';

	interface Props {
		bucketName: string;
	}

	const { bucketName }: Props = $props();

	const grants = getGrantsContext();
	const keys = getKeysContext();
	const buckets = getBucketsContext();

	let isLoading = $state(true);
	let loadError = $state<string | null>(null);

	// Modals & Forms State
	let showCreateModal = $state(false);
	let granteeType = $state<'key' | 'manual'>('key');
	let selectedKeyId = $state('');
	let manualUserId = $state('');
	let selectedActions = $state<string[]>([]);
	let keyPrefix = $state('');
	let note = $state('');
	let createError = $state<string | null>(null);
	let isCreating = $state(false);

	let showTransferModal = $state(false);
	let transferTargetType = $state<'key' | 'manual'>('key');
	let transferSelectedKeyId = $state('');
	let transferManualUserId = $state('');
	let transferError = $state<string | null>(null);
	let isTransferring = $state(false);

	let deleteTarget = $state<BucketGrant | null>(null);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		loadError = null;
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
			return `${key.displayName} (${key.accessKeyId})`;
		}
		return userId;
	}

	// Filter active keys to list as potential grantees/new owners
	const activeKeys = $derived(keys.items.filter((k) => k.isActive));
	const ownerKey = $derived(keys.items.find((k) => k.id === buckets.selected?.ownerId));

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

	function openCreateModal() {
		showCreateModal = true;
		createError = null;
		selectedActions = ['s3:GetObject', 's3:ListBucket'];
		keyPrefix = '';
		note = '';
		granteeType = activeKeys.length > 0 ? 'key' : 'manual';
		selectedKeyId = activeKeys[0]?.id ?? '';
		manualUserId = '';
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		createError = null;

		const granteeUserId = granteeType === 'key' ? selectedKeyId : manualUserId.trim();

		if (!granteeUserId) {
			createError = 'Grantee is required';
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

	async function handleToggleActive(grant: BucketGrant) {
		await grants.update(bucketName, grant.id, {
			isActive: !grant.isActive
		});
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		const success = await grants.remove(bucketName, deleteTarget.id);
		if (success) {
			deleteTarget = null;
		}
	}

	function openTransferModal() {
		showTransferModal = true;
		transferError = null;
		transferTargetType = activeKeys.length > 0 ? 'key' : 'manual';
		transferSelectedKeyId =
			activeKeys.find((k) => k.id !== buckets.selected?.ownerId)?.id ?? activeKeys[0]?.id ?? '';
		transferManualUserId = '';
	}

	async function handleTransfer(e: Event) {
		e.preventDefault();
		transferError = null;

		const newOwnerUserId =
			transferTargetType === 'key' ? transferSelectedKeyId : transferManualUserId.trim();

		if (!newOwnerUserId) {
			transferError = 'New owner user ID is required';
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

<div class="flex flex-col gap-6">
	{#if isLoading}
		<LoadingSpinner label="Loading bucket permissions..." minHeight="12rem" />
	{:else if isForbidden}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-6 text-center">
			<ShieldIcon class="mx-auto mb-3 h-8 w-8 text-danger-400" />
			<h3 class="text-sm font-semibold text-danger-300">Access Denied</h3>
			<p class="mx-auto mt-2 max-w-md text-xs text-surface-400">
				You do not have permission to manage permissions for bucket <strong>{bucketName}</strong>.
				Only the bucket owner or an administrator can view and modify sharing grants.
			</p>
		</div>
	{:else if loadError}
		<div
			class="flex items-center gap-3 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400"
		>
			<AlertCircleIcon class="h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">Failed to load permissions</p>
				<p class="text-xs text-surface-500">{loadError}</p>
			</div>
		</div>
	{:else}
		<div class="grid gap-6 lg:grid-cols-[1fr_320px]">
			<!-- Left side: Grants Table -->
			<div class="flex flex-col gap-4 rounded-xl border border-surface-800 bg-surface-900 p-5">
				<div class="flex items-center justify-between gap-4">
					<div>
						<h2 class="text-base font-semibold text-surface-200">Sharing & Access Grants</h2>
						<p class="mt-1 text-xs text-surface-500">
							Assign S3 data-plane permissions to other users using mini-IAM resource grants.
						</p>
					</div>
					<button
						onclick={openCreateModal}
						class="flex items-center gap-1.5 rounded-lg bg-accent-500/15 px-3 py-1.5 text-xs font-semibold text-accent-400 transition-colors hover:bg-accent-500/25"
					>
						<PlusIcon size={14} />
						Add Grant
					</button>
				</div>

				{#if grants.items.length === 0}
					<div class="py-12 text-center">
						<ShieldIcon class="text-surface-650 mx-auto mb-2.5 h-7 w-7" />
						<p class="text-xs font-medium text-surface-400">No active grants</p>
						<p class="mt-1 text-[11px] text-surface-600">
							This bucket is currently private. Click "Add Grant" to share access.
						</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full border-collapse text-left text-xs">
							<thead>
								<tr
									class="border-b border-surface-800 text-[10px] font-semibold tracking-wider text-surface-500 uppercase"
								>
									<th class="pb-2.5 font-medium">Grantee</th>
									<th class="pb-2.5 font-medium">Action</th>
									<th class="pb-2.5 font-medium">Prefix</th>
									<th class="pb-2.5 font-medium">Note</th>
									<th class="pb-2.5 font-medium">Status</th>
									<th class="pb-2.5 text-right font-medium">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-850">
								{#each grants.items as grant (grant.id)}
									<tr class="hover:bg-surface-850/30">
										<td
											class="max-w-[150px] truncate py-3 font-medium text-surface-200"
											title={grant.granteeUserId}
										>
											{resolveGranteeName(grant.granteeUserId)}
										</td>
										<td class="py-3">
											<code
												class="rounded border border-surface-850 bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] text-accent-400"
											>
												{grant.action}
											</code>
										</td>
										<td class="py-3 font-mono text-[11px] text-surface-300">
											{#if grant.keyPrefix}
												{grant.keyPrefix}
											{:else}
												<span class="text-surface-600 italic">Entire Bucket</span>
											{/if}
										</td>
										<td class="max-w-[120px] truncate py-3 text-surface-400" title={grant.note}>
											{grant.note || '-'}
										</td>
										<td class="py-3">
											<button
												onclick={() => handleToggleActive(grant)}
												class="transition-opacity hover:opacity-80"
												title="Click to toggle status"
											>
												<StatusBadge status={grant.isActive ? 'active' : 'inactive'} />
											</button>
										</td>
										<td class="py-3 text-right">
											<button
												onclick={() => (deleteTarget = grant)}
												class="rounded p-1 text-surface-500 transition-colors hover:bg-danger-500/10 hover:text-danger-400"
												aria-label="Delete grant"
											>
												<Trash2Icon size={14} />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Right side: Ownership & Stats Card -->
			<div class="flex flex-col gap-5 rounded-xl border border-surface-800 bg-surface-900 p-5">
				<div>
					<h3 class="text-sm font-semibold text-surface-200">Bucket Details</h3>
					<p class="mt-1 text-xs text-surface-500">Metadata and administrative actions.</p>
				</div>

				<div class="space-y-4 divide-y divide-surface-850">
					<!-- Owner Info -->
					<div class="pt-1">
						<div class="flex items-center gap-2 text-xs font-semibold text-surface-400">
							<UserIcon size={14} class="text-accent-400" />
							Bucket Owner
						</div>
						<div class="mt-2 rounded-lg border border-surface-850 bg-surface-950 p-3">
							{#if ownerKey}
								<p class="text-sm font-semibold text-surface-200">
									{ownerKey.displayName}
								</p>
								<p class="mt-0.5 font-mono text-[10px] text-surface-500" title={ownerKey.id}>
									ID: {ownerKey.id.slice(0, 8)}...{ownerKey.id.slice(-4)}
								</p>
							{:else if buckets.selected?.ownerId}
								<p class="font-mono text-xs text-surface-300" title={buckets.selected.ownerId}>
									ID: {buckets.selected.ownerId.slice(0, 8)}...{buckets.selected.ownerId.slice(-4)}
								</p>
							{:else}
								<p class="text-xs text-surface-500 italic">Unknown Owner</p>
							{/if}
						</div>

						<button
							onclick={openTransferModal}
							class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-800 bg-surface-850/50 py-2 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-800"
						>
							<SettingsIcon size={13} />
							Transfer Ownership
						</button>
					</div>

					<!-- S3 Compatibility Status -->
					<div class="pt-4">
						<div class="flex items-center gap-2 text-xs font-semibold text-surface-400">
							<ShieldIcon size={14} class="text-accent-400" />
							Access Model
						</div>
						<p class="mt-2 text-xs leading-relaxed text-surface-400">
							FBS uses a sqlite-backed policy evaluator. Bucket owners and admins bypass grant
							checks. Other keys must have a matching active grant to perform S3 actions.
						</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Modal: Add Grant -->
<Modal
	open={showCreateModal}
	title="Create Sharing Grant"
	description="Assign actions and folder path prefixes to a user."
	onclose={() => (showCreateModal = false)}
>
	<form onsubmit={handleCreate} class="space-y-4">
		<!-- Grantee Type Selector -->
		{#if activeKeys.length > 0}
			<div class="flex rounded-lg border border-surface-800 bg-surface-950 p-1">
				<button
					type="button"
					onclick={() => (granteeType = 'key')}
					class="flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors {granteeType ===
					'key'
						? 'bg-surface-850 text-surface-100'
						: 'text-surface-500 hover:text-surface-300'}"
				>
					Select Key
				</button>
				<button
					type="button"
					onclick={() => (granteeType = 'manual')}
					class="flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors {granteeType ===
					'manual'
						? 'bg-surface-850 text-surface-100'
						: 'text-surface-500 hover:text-surface-300'}"
				>
					Manual User ID
				</button>
			</div>
		{/if}

		{#if granteeType === 'key' && activeKeys.length > 0}
			<div>
				<label for="grantee-key" class="mb-1 block text-xs font-medium text-surface-400">
					Select Access Key
				</label>
				<select
					id="grantee-key"
					bind:value={selectedKeyId}
					class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-surface-100 outline-none focus:border-accent-500"
				>
					{#each activeKeys as key (key.id)}
						<option value={key.id}>{key.displayName} ({key.accessKeyId})</option>
					{/each}
				</select>
			</div>
		{:else}
			<div>
				<label for="manual-user-id" class="mb-1 block text-xs font-medium text-surface-400">
					Grantee User ID (UUID)
				</label>
				<input
					id="manual-user-id"
					type="text"
					bind:value={manualUserId}
					placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
					required
					class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 font-mono text-xs text-surface-100 outline-none focus:border-accent-500"
				/>
			</div>
		{/if}

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
		{#if activeKeys.length > 0}
			<div class="flex rounded-lg border border-surface-800 bg-surface-950 p-1">
				<button
					type="button"
					onclick={() => (transferTargetType = 'key')}
					class="flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors {transferTargetType ===
					'key'
						? 'bg-surface-850 text-surface-100'
						: 'text-surface-500 hover:text-surface-300'}"
				>
					Select Key
				</button>
				<button
					type="button"
					onclick={() => (transferTargetType = 'manual')}
					class="flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors {transferTargetType ===
					'manual'
						? 'bg-surface-850 text-surface-100'
						: 'text-surface-500 hover:text-surface-300'}"
				>
					Manual User ID
				</button>
			</div>
		{/if}

		{#if transferTargetType === 'key' && activeKeys.length > 0}
			<div>
				<label for="transfer-key" class="mb-1 block text-xs font-medium text-surface-400">
					Select Access Key
				</label>
				<select
					id="transfer-key"
					bind:value={transferSelectedKeyId}
					class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-surface-100 outline-none focus:border-accent-500"
				>
					{#each activeKeys as key (key.id)}
						<option value={key.id} disabled={key.id === buckets.selected?.ownerId}>
							{key.displayName} ({key.accessKeyId}) {key.id === buckets.selected?.ownerId
								? '(Current Owner)'
								: ''}
						</option>
					{/each}
				</select>
			</div>
		{:else}
			<div>
				<label for="transfer-manual-id" class="mb-1 block text-xs font-medium text-surface-400">
					New Owner User ID (UUID)
				</label>
				<input
					id="transfer-manual-id"
					type="text"
					bind:value={transferManualUserId}
					placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
					required
					class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 font-mono text-xs text-surface-100 outline-none focus:border-accent-500"
				/>
			</div>
		{/if}

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
	open={deleteTarget !== null}
	title="Remove Sharing Grant"
	description="Are you sure you want to remove this grant? The user will immediately lose S3 access granted by this row."
	confirmLabel="Remove Grant"
	destructive
	onconfirm={handleDelete}
	oncancel={() => (deleteTarget = null)}
/>
