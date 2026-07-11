<script lang="ts">
	import { resolve } from '$app/paths';
	import MetricCard from '$lib/components/MetricCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import { getDashboardContext } from '$lib/stores/dashboard.svelte';
	import { getPageActionsContext } from '$lib/stores/page-actions.svelte';
	import { getServerContext } from '$lib/stores/server.svelte';
	import type { ActivityAction } from '$lib/types/api';
	import { formatBytes, formatDate, timeAgo } from '$lib/utils/format';
	import { onDestroy, onMount } from 'svelte';

	const dashboard = getDashboardContext();
	const buckets = getBucketsContext();
	const server = getServerContext();
	const pageActions = getPageActionsContext();

	let isRefreshing = $state(false);

	const largestBuckets = $derived(
		[...buckets.items].sort((a, b) => (b.totalObjectBytes ?? 0) - (a.totalObjectBytes ?? 0))
	);

	onMount(() => {
		void refresh();
	});

	// Re-register so the button label/disabled state stay in sync while refreshing
	$effect(() => {
		void isRefreshing;
		pageActions.setActions(topBarActions);
	});

	onDestroy(() => {
		pageActions.clearActions();
	});

	async function refresh() {
		if (isRefreshing) return;
		isRefreshing = true;
		try {
			await Promise.all([dashboard.load(), buckets.load(), server.loadActivity({ limit: 50 })]);
		} finally {
			isRefreshing = false;
		}
	}

	function activityLabel(action: ActivityAction): string {
		const labels: Record<string, string> = {
			put_object: 'Uploaded',
			delete_object: 'Deleted object',
			delete_objects: 'Deleted objects',
			copy_object: 'Copied object',
			create_bucket: 'Created bucket',
			delete_bucket: 'Deleted bucket',
			force_delete_bucket: 'Deleted bucket',
			empty_bucket: 'Emptied bucket'
		};
		return labels[action] ?? action.replaceAll('_', ' ');
	}
</script>

{#snippet topBarActions()}
	<button
		onclick={() => void refresh()}
		disabled={isRefreshing}
		class="inline-flex items-center gap-1.5 rounded-lg bg-accent-500/15 px-3.5 py-1.5 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25 disabled:opacity-50"
	>
		<svg
			class="h-3.5 w-3.5 {isRefreshing ? 'animate-spin' : ''}"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M21 12a9 9 0 1 1-2.64-6.36" />
			<polyline points="21 3 21 9 15 9" />
		</svg>
		{isRefreshing ? 'Refreshing…' : 'Refresh'}
	</button>
{/snippet}

<svelte:head>
	<title>Dashboard — FBS</title>
</svelte:head>

<!-- Full-height shell: page never scrolls; tables fill remaining space then scroll -->
<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
	{#if dashboard.error}
		<div
			class="shrink-0 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400"
		>
			{dashboard.error}
		</div>
	{/if}
	{#if server.error}
		<div
			class="shrink-0 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400"
		>
			{server.error}
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
		<!-- Left: Recent Activity — grows to page bottom, then scrolls -->
		<div
			class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-800 bg-surface-900 lg:w-[calc(0.8*(100%-300px-1rem))] lg:flex-none"
		>
			<div class="shrink-0 border-b border-surface-800 px-4 py-3">
				<h2 class="text-sm font-semibold text-surface-200">Recent Activity</h2>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if server.isLoadingActivity && server.activity.length === 0}
					<LoadingSpinner label="Loading activity..." minHeight="10rem" />
				{:else if server.activity.length === 0}
					<div class="p-6">
						<EmptyState
							icon="•"
							title="No activity yet"
							description="Recent API activity will appear here."
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-800/50">
						{#each server.activity as item (item.id)}
							<div class="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
								<div class="min-w-0">
									<p class="truncate text-sm text-surface-200">
										<span class="font-medium">{activityLabel(item.action)}</span>
										<span class="text-surface-500"> in </span>
										<span>{item.bucket}</span>
									</p>
									{#if item.key}
										<p class="mt-0.5 truncate text-xs text-surface-600">{item.key}</p>
									{/if}
								</div>
								<div class="flex items-center gap-3 text-xs text-surface-500 sm:justify-end">
									{#if item.size !== undefined}
										<span>{formatBytes(item.size)}</span>
									{/if}
									<span>{timeAgo(item.createdAt)}</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Right: stats 2×2 + Largest Buckets (table fills rest, then scrolls) -->
		<div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden lg:min-w-[300px]">
			{#if dashboard.isLoading && !dashboard.metrics}
				<LoadingSpinner label="Loading..." minHeight="9rem" />
			{:else if dashboard.metrics}
				<div class="grid shrink-0 grid-cols-2 gap-3">
					<MetricCard
						label="Buckets"
						value={dashboard.metrics.totalBuckets.toLocaleString()}
						icon="bucket"
						accentColor="emerald"
					/>
					<MetricCard
						label="Objects"
						value={dashboard.metrics.totalObjects.toLocaleString()}
						icon="object"
						accentColor="blue"
					/>
					<MetricCard
						label="Storage"
						value={formatBytes(dashboard.metrics.totalStorageBytes)}
						icon="storage"
						accentColor="amber"
					/>
					<MetricCard
						label="Access Keys"
						value={dashboard.metrics.activeKeys.toLocaleString()}
						icon="key"
						accentColor="rose"
					/>
				</div>
			{/if}

			<div
				class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-800 bg-surface-900"
			>
				<div class="shrink-0 border-b border-surface-800 px-4 py-3">
					<h2 class="text-sm font-semibold text-surface-200">Largest Buckets</h2>
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto">
					{#if buckets.isLoading && buckets.items.length === 0}
						<LoadingSpinner label="Loading buckets..." minHeight="13rem" />
					{:else if largestBuckets.length === 0}
						<div class="p-6">
							<EmptyState
								icon="🪣"
								title="No buckets"
								description="Create a bucket to see usage here."
							/>
						</div>
					{:else}
						<div
							class="sticky top-0 z-10 grid grid-cols-[1fr_72px_80px] items-center gap-2 border-b border-surface-800 bg-surface-900 px-4 py-2.5 text-xs font-medium text-surface-500 uppercase"
						>
							<span>Name</span>
							<span class="text-right">Objects</span>
							<span class="text-right">Storage</span>
						</div>
						{#each largestBuckets as bucket (bucket.name)}
							<a
								href={resolve('/app/buckets/[bucket]', { bucket: bucket.name })}
								class="grid grid-cols-[1fr_72px_80px] items-center gap-2 border-b border-surface-800/50 px-4 py-3 hover:bg-surface-850"
							>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-surface-200">{bucket.name}</p>
									<p class="mt-0.5 text-xs text-surface-600">
										Created {bucket.createdAt ? formatDate(bucket.createdAt) : 'recently'}
									</p>
								</div>
								<span class="text-right text-sm text-surface-400">{bucket.objectCount ?? 0}</span>
								<span class="text-right text-sm text-surface-300">
									{formatBytes(bucket.totalObjectBytes ?? 0)}
								</span>
							</a>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
