<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { onMount } from 'svelte';

	const buckets = getBucketsContext();

	let showCreateForm = $state(false);
	let showAddForm = $state(false);
	let newBucketName = $state('');
	let existingBucketName = $state('');
	let createError = $state<string | null>(null);
	let addError = $state<string | null>(null);

	let removeTarget = $state<string | null>(null);

	onMount(() => {
		buckets.load();
	});

	async function handleCreate(e: Event) {
		e.preventDefault();
		createError = null;

		const name = newBucketName.trim().toLowerCase();

		if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name)) {
			createError =
				'Bucket name must be 3-63 characters, lowercase letters, numbers, hyphens, and periods.';
			return;
		}

		const success = await buckets.create(name);
		if (success) {
			newBucketName = '';
			showCreateForm = false;
		} else {
			createError = buckets.error;
		}
	}

	async function handleAdd(e: Event) {
		e.preventDefault();
		addError = null;

		const name = existingBucketName.trim().toLowerCase();
		if (!name) {
			addError = 'Please enter a bucket name';
			return;
		}

		const success = await buckets.addExisting(name);
		if (success) {
			existingBucketName = '';
			showAddForm = false;
		} else {
			addError = buckets.error;
		}
	}

	function handleRemove() {
		if (!removeTarget) return;
		buckets.removeFromList(removeTarget);
		removeTarget = null;
	}
</script>

<svelte:head>
	<title>Buckets — FBS</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold tracking-tight text-surface-100">Buckets</h1>
			<p class="mt-0.5 text-sm text-surface-500">
				{buckets.count} bucket{buckets.count !== 1 ? 's' : ''} tracked
			</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => {
					showAddForm = !showAddForm;
					showCreateForm = false;
					addError = null;
					existingBucketName = '';
				}}
				class="rounded-lg bg-surface-800/60 px-3.5 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-800 hover:text-surface-100"
			>
				{showAddForm ? 'Cancel' : '+ Add Existing'}
			</button>
			<button
				onclick={() => {
					showCreateForm = !showCreateForm;
					showAddForm = false;
					createError = null;
					newBucketName = '';
				}}
				class="rounded-lg bg-accent-500/15 px-3.5 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
			>
				{showCreateForm ? 'Cancel' : '+ Create Bucket'}
			</button>
		</div>
	</div>

	<!-- Add Existing Bucket Form -->
	{#if showAddForm}
		<form onsubmit={handleAdd} class="rounded-xl border border-surface-800 bg-surface-900 p-5">
			<h2 class="mb-1 text-sm font-semibold text-surface-200">Add Existing Bucket</h2>
			<p class="mb-3 text-xs text-surface-500">
				Enter the name of a bucket that already exists on the server.
			</p>
			<div class="flex gap-3">
				<input
					type="text"
					bind:value={existingBucketName}
					placeholder="my-existing-bucket"
					required
					class="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 placeholder-surface-600 transition-colors outline-none focus:border-accent-500"
				/>
				<button
					type="submit"
					class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
				>
					Add
				</button>
			</div>
			{#if addError}
				<p class="mt-2 text-xs text-danger-400">{addError}</p>
			{/if}
		</form>
	{/if}

	<!-- Create Bucket Form -->
	{#if showCreateForm}
		<form onsubmit={handleCreate} class="rounded-xl border border-surface-800 bg-surface-900 p-5">
			<h2 class="mb-3 text-sm font-semibold text-surface-200">New Bucket</h2>
			<div class="flex gap-3">
				<input
					type="text"
					bind:value={newBucketName}
					placeholder="my-bucket-name"
					required
					class="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2 text-sm text-surface-100 placeholder-surface-600 transition-colors outline-none focus:border-accent-500"
				/>
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

	<!-- Error -->
	{#if buckets.error && !createError && !addError}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{buckets.error}
		</div>
	{/if}

	<!-- Loading -->
	{#if buckets.isLoading}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array.from({ length: 3 }, (_, i) => i) as i (i)}
				<div class="h-24 animate-pulse rounded-xl border border-surface-800 bg-surface-900"></div>
			{/each}
		</div>
	{:else if buckets.count === 0}
		<EmptyState
			icon="🪣"
			title="No buckets tracked"
			description="Create a new bucket or add an existing one by name."
		>
			{#snippet action()}
				<div class="flex gap-2">
					<button
						onclick={() => (showAddForm = true)}
						class="rounded-lg bg-surface-800/60 px-4 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-800 hover:text-surface-100"
					>
						Add Existing
					</button>
					<button
						onclick={() => (showCreateForm = true)}
						class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
					>
						Create Bucket
					</button>
				</div>
			{/snippet}
		</EmptyState>
	{:else}
		<!-- Bucket Grid -->
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each buckets.items as bucket (bucket.name)}
				<a
					href={resolveRoute('/app/buckets/[bucket]', { bucket: bucket.name })}
					class="group rounded-xl border border-surface-800 bg-surface-900 p-4 transition-all duration-150 hover:border-surface-700 hover:shadow-lg hover:shadow-black/20"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2.5">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400 ring-1 ring-accent-500/20"
							>
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<ellipse cx="12" cy="5" rx="9" ry="3" />
									<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
									<path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
								</svg>
							</div>
							<div>
								<p class="text-sm font-medium text-surface-200 group-hover:text-surface-100">
									{bucket.name}
								</p>
							</div>
						</div>

						<!-- Remove from list button -->
						<button
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								removeTarget = bucket.name;
							}}
							class="rounded-md p-1.5 text-surface-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-danger-500/10 hover:text-danger-400"
							aria-label="Remove {bucket.name} from list"
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
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					</div>
				</a>
			{/each}
		</div>
	{/if}

	<!-- Info banner -->
	<div class="rounded-lg border border-surface-800/50 bg-surface-900/50 px-4 py-3">
		<p class="text-xs text-surface-500">
			Bucket listing will auto-populate once the Management API is available. For now, add buckets
			by name or create new ones.
		</p>
	</div>
</div>

<!-- Remove Confirmation -->
<ConfirmDialog
	open={removeTarget !== null}
	title="Remove Bucket"
	description="Remove &quot;{removeTarget}&quot; from your tracked list? This does not delete the bucket or its data from the server."
	confirmLabel="Remove"
	destructive={false}
	onconfirm={handleRemove}
	oncancel={() => (removeTarget = null)}
/>
