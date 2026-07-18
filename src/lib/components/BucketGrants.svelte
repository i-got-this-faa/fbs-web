<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getGrantsContext } from '$lib/stores/grants.svelte';
	import { getKeysContext } from '$lib/stores/keys.svelte';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { BucketGrant, CreateBucketGrantRequest } from '$lib/types/api';
	import { ShieldIcon, UserIcon, Trash2Icon, AlertCircleIcon, SettingsIcon } from 'lucide-svelte';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/table';

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
	const expandedGroupIds = new SvelteSet<string>();

	function toggleGroupExpanded(groupId: string) {
		if (expandedGroupIds.has(groupId)) {
			expandedGroupIds.delete(groupId);
		} else {
			expandedGroupIds.add(groupId);
		}
	}

	$effect(() => {
		if (showCreateModal) {
			untrack(() => {
				createError = null;
				selectedActions = ['s3:GetObject', 's3:ListBucket'];
				keyPrefix = '';
				note = '';
				granteeType = activeKeys.length > 0 ? 'key' : 'manual';
				selectedKeyId = activeKeys[0]?.id ?? '';
				manualUserId = '';
			});
		}
	});

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

	$effect(() => {
		if (bucketName) {
			void loadData();
		}
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

	// Group active keys by displayName (user)
	const keysByUser = $derived.by(() => {
		const groups: Record<string, typeof activeKeys> = {};
		for (const key of activeKeys) {
			if (!groups[key.displayName]) {
				groups[key.displayName] = [];
			}
			groups[key.displayName].push(key);
		}
		return groups;
	});

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
			const [granteeUserId, keyPrefix] = keyStr.split('::');
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

	async function handleToggleActiveGroup(group: GroupedGrant) {
		const newStatus = !group.isActive;
		await Promise.all(
			group.grants.map((grant) =>
				grants.update(bucketName, grant.id, {
					isActive: newStatus
				})
			)
		);
	}

	async function handleDeleteGroup() {
		if (!deleteGroupTarget) return;
		const targets = deleteGroupTarget.grants;
		deleteGroupTarget = null;
		await Promise.all(targets.map((grant) => grants.remove(bucketName, grant.id)));
	}

	async function handleDeleteIndividual() {
		if (!deleteIndividualTarget) return;
		const target = deleteIndividualTarget;
		deleteIndividualTarget = null;
		await grants.remove(bucketName, target.id);
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
			<div class="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
				<Table class="table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead class="w-[22%] font-medium">Grantee</TableHead>
							<TableHead class="w-[28%] font-medium">Action</TableHead>
							<TableHead class="w-[15%] font-medium">Prefix</TableHead>
							<TableHead class="w-[20%] font-medium">Note</TableHead>
							<TableHead class="w-[90px] font-medium">Status</TableHead>
							<TableHead class="w-[60px] text-right font-medium">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each groupedGrants as group (group.id)}
							{@const isExpanded = expandedGroupIds.has(group.id)}
							<TableRow>
								<TableCell
									class="max-w-[150px] truncate font-medium text-surface-200"
									title={group.granteeUserId}
								>
									<button
										type="button"
										onclick={() => toggleGroupExpanded(group.id)}
										class="flex items-center gap-1.5 text-left text-xs font-semibold text-surface-300 transition-colors hover:text-accent-400 focus:outline-none"
									>
										<span
											class="inline-block w-3 text-center font-mono text-[10px] text-surface-500"
										>
											{isExpanded ? '▼' : '▶'}
										</span>
										<span>{resolveGranteeName(group.granteeUserId)}</span>
									</button>
								</TableCell>
								<TableCell class="font-medium text-surface-400">
									<span
										class="rounded border border-surface-850 bg-surface-950 px-1.5 py-0.5 font-sans text-[10px] text-surface-400"
									>
										{group.grants.length} Actions
									</span>
								</TableCell>
								<TableCell class="font-mono text-[11px] text-surface-300">
									{#if group.keyPrefix}
										{group.keyPrefix}
									{:else}
										<span class="text-surface-600 italic">Entire Bucket</span>
									{/if}
								</TableCell>
								<TableCell class="max-w-[120px] truncate text-surface-400" title={group.note}>
									{group.note || '-'}
								</TableCell>
								<TableCell>
									<button
										onclick={() => handleToggleActiveGroup(group)}
										class="transition-opacity hover:opacity-80"
										title="Click to toggle status"
									>
										<StatusBadge status={group.isActive ? 'active' : 'inactive'} />
									</button>
								</TableCell>
								<TableCell class="text-right">
									<button
										onclick={() => (deleteGroupTarget = group)}
										class="rounded p-1 text-surface-500 transition-colors hover:bg-danger-500/10 hover:text-danger-400"
										aria-label="Delete grant"
									>
										<Trash2Icon size={14} />
									</button>
								</TableCell>
							</TableRow>

							{#if isExpanded}
								{#each group.grants as grant, idx (grant.id)}
									{@const isLast = idx === group.grants.length - 1}
									<TableRow
										class="border-none bg-surface-950/20 text-surface-400 hover:bg-surface-850/10"
									>
										<TableCell
											colspan={6}
											class="py-2 pl-12 font-mono text-[11px] whitespace-nowrap text-surface-500"
										>
											<div class="flex w-[320px] items-center justify-between">
												<div class="flex items-center gap-2">
													<span class="font-mono text-surface-700 select-none">
														{isLast ? '└──' : '├──'}
													</span>
													<code
														class="rounded border border-surface-850 bg-surface-950/50 px-1.5 py-0.5 font-mono text-[10px] text-accent-400"
													>
														{grant.action}
													</code>
												</div>
												<button
													type="button"
													onclick={() => (deleteIndividualTarget = grant)}
													class="rounded p-0.5 text-surface-600 transition-colors hover:bg-danger-500/10 hover:text-danger-400"
													title="Remove this permission"
												>
													<Trash2Icon size={11} />
												</button>
											</div>
										</TableCell>
									</TableRow>
								{/each}
							{/if}
						{/each}
					</TableBody>
				</Table>
			</div>
		{/if}
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
					{#each Object.entries(keysByUser) as [user, userKeys] (user)}
						<optgroup label={user}>
							{#each userKeys as key (key.id)}
								<option value={key.id}>
									{key.accessKeyId} ({key.role})
								</option>
							{/each}
						</optgroup>
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
					{#each Object.entries(keysByUser) as [user, userKeys] (user)}
						<optgroup label={user}>
							{#each userKeys as key (key.id)}
								<option value={key.id} disabled={key.id === buckets.selected?.ownerId}>
									{key.accessKeyId} ({key.role}){key.id === buckets.selected?.ownerId
										? ' (Current Owner)'
										: ''}
								</option>
							{/each}
						</optgroup>
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
	open={deleteGroupTarget !== null}
	title="Remove Sharing Grant Group"
	description="Are you sure you want to remove all sharing grants for this grantee and prefix? The grantee will immediately lose all associated permissions."
	confirmLabel="Remove Group"
	destructive
	onconfirm={handleDeleteGroup}
	oncancel={() => (deleteGroupTarget = null)}
/>

<ConfirmDialog
	open={deleteIndividualTarget !== null}
	title="Remove Permission"
	description="Are you sure you want to remove this specific permission? The grantee will lose this action immediately."
	confirmLabel="Remove Permission"
	destructive
	onconfirm={handleDeleteIndividual}
	oncancel={() => (deleteIndividualTarget = null)}
/>
