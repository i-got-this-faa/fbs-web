<script lang="ts">
	import { resolve } from '$app/paths';
	import MetricCard from '$lib/components/MetricCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { getBucketsContext } from '$lib/stores/buckets.svelte';
	import { getDashboardContext } from '$lib/stores/dashboard.svelte';
	import { getServerContext } from '$lib/stores/server.svelte';
	import type { ActivityAction } from '$lib/types/api';
	import { formatBytes, formatDate, timeAgo } from '$lib/utils/format';
	import { onMount } from 'svelte';

	const dashboard = getDashboardContext();
	const buckets = getBucketsContext();
	const server = getServerContext();

	const largestBuckets = $derived(
		[...buckets.items]
			.sort((a, b) => (b.totalObjectBytes ?? 0) - (a.totalObjectBytes ?? 0))
			.slice(0, 5)
	);

	onMount(() => {
		dashboard.load();
		buckets.load();
		server.loadActivity({ limit: 10 });
	});

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

<svelte:head>
	<title>Dashboard — FBS</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6">
	{#if dashboard.error}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{dashboard.error}
		</div>
	{/if}
	{#if server.error}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{server.error}
		</div>
	{/if}

	{#if dashboard.isLoading && !dashboard.metrics}
		<div class="rounded-xl border border-surface-800 bg-surface-900">
			<LoadingSpinner label="Loading dashboard..." minHeight="9rem" />
		</div>
	{:else if dashboard.metrics}
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

	<div class="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
		<div class="space-y-4">
			<div class="overflow-hidden rounded-xl border border-surface-800 bg-surface-900">
				<div class="border-b border-surface-800 px-4 py-3">
					<h2 class="text-sm font-semibold text-surface-200">Largest Buckets</h2>
				</div>

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
						class="grid grid-cols-[1fr_110px_120px] items-center gap-3 border-b border-surface-800 px-4 py-2.5 text-xs font-medium text-surface-500 uppercase"
					>
						<span>Name</span>
						<span class="text-right">Objects</span>
						<span class="text-right">Storage</span>
					</div>
					{#each largestBuckets as bucket (bucket.name)}
						<a
							href={resolve('/app/buckets/[bucket]', { bucket: bucket.name })}
							class="grid grid-cols-[1fr_110px_120px] items-center gap-3 border-b border-surface-800/50 px-4 py-3 hover:bg-surface-850"
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

			<div class="overflow-hidden rounded-xl border border-surface-800 bg-surface-900">
				<div class="border-b border-surface-800 px-4 py-3">
					<h2 class="text-sm font-semibold text-surface-200">Recent Activity</h2>
				</div>
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

		<div class="rounded-xl border border-surface-800 bg-surface-900 p-4">
			<h2 class="text-sm font-semibold text-surface-200">Connection</h2>
			<div class="mt-4 space-y-3">
				<div class="flex items-center justify-between">
					<span class="text-xs text-surface-500">Management API</span>
					<span class="flex items-center gap-1.5 text-xs text-success-400">
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-success-500"></span>
						Online
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-xs text-surface-500">Bucket summaries</span>
					<span class="text-xs text-surface-300">{buckets.count.toLocaleString()}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-xs text-surface-500">Key records</span>
					<span class="text-xs text-surface-300">
						{dashboard.metrics?.totalKeys.toLocaleString() ?? '0'}
					</span>
				</div>
			</div>
		</div>
	</div>
</div>
