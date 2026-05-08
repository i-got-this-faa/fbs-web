<script lang="ts">
	import { resolve } from '$app/paths';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { formatBytes, formatDate } from '$lib/utils/format';
	import { onDestroy, onMount } from 'svelte';

	const buckets = getBucketsContext();
	const pageActions = getPageActionsContext();

	let showCreateForm = $state(false);
	let newBucketName = $state('');
	let createError = $state<string | null>(null);

	onMount(() => {
		buckets.load();
		pageActions.setActions(topBarActions);
	});

	onDestroy(() => {
		pageActions.clearActions();
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
</script>

{#snippet topBarActions()}
	<button
		onclick={() => {
			showCreateForm = !showCreateForm;
			createError = null;
			newBucketName = '';
		}}
		class="rounded-lg bg-accent-500/15 px-3.5 py-1.5 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
	>
		{showCreateForm ? 'Cancel' : '+ Create Bucket'}
	</button>
{/snippet}

<svelte:head>
	<title>Buckets — FBS</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
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

	{#if buckets.error && !createError}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{buckets.error}
		</div>
	{/if}

	{#if buckets.isLoading}
		<div class="rounded-xl border border-surface-800 bg-surface-900">
			<LoadingSpinner label="Loading buckets..." minHeight="12rem" />
		</div>
	{:else if buckets.count === 0}
		<EmptyState
			icon="🪣"
			title="No buckets"
			description="Create a bucket to start storing objects."
		>
			{#snippet action()}
				<button
					onclick={() => (showCreateForm = true)}
					class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
				>
					Create Bucket
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each buckets.items as bucket (bucket.name)}
				<a
					href={resolve('/app/buckets/[bucket]', { bucket: bucket.name })}
					class="group rounded-xl border border-surface-800 bg-surface-900 p-4 transition-all duration-150 hover:border-surface-700 hover:shadow-lg hover:shadow-black/20"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex min-w-0 items-center gap-2.5">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400 ring-1 ring-accent-500/20"
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
							<div class="min-w-0">
								<p
									class="truncate text-sm font-medium text-surface-200 group-hover:text-surface-100"
								>
									{bucket.name}
								</p>
								<p class="mt-0.5 text-xs text-surface-600">
									Created {bucket.createdAt ? formatDate(bucket.createdAt) : 'recently'}
								</p>
							</div>
						</div>

						<span class="shrink-0 text-xs text-surface-500">{bucket.objectCount ?? 0} objects</span>
					</div>
					<div class="mt-4 flex items-center justify-between border-t border-surface-800/60 pt-3">
						<span class="text-xs text-surface-600">Storage</span>
						<span class="text-xs font-medium text-surface-300">
							{formatBytes(bucket.totalObjectBytes ?? 0)}
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
