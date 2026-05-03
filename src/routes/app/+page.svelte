<script lang="ts">
	import MetricCard from '$lib/components/MetricCard.svelte';
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import type { DashboardMetrics } from '$lib/types/api';
	import { formatBytes, timeAgo, keyBasename, contentTypeIcon } from '$lib/utils/format';
	import { onMount } from 'svelte';

	const connection = getConnectionContext();

	let metrics = $state<DashboardMetrics | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		if (!connection.client) return;

		try {
			metrics = await connection.client.getMetrics();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load metrics';
		} finally {
			isLoading = false;
		}
	});
</script>

<svelte:head>
	<title>Dashboard — FBS</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-lg font-semibold tracking-tight text-surface-100">Dashboard</h1>
		<p class="mt-0.5 text-sm text-surface-500">Overview of your storage backend</p>
	</div>

	{#if isLoading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
				<div class="h-28 animate-pulse rounded-xl border border-surface-800 bg-surface-900"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-xl border border-danger-500/20 bg-danger-500/5 p-4 text-sm text-danger-400">
			{error}
		</div>
	{:else if metrics}
		<!-- Metric Cards -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<MetricCard
				label="Buckets"
				value={String(metrics.totalBuckets)}
				icon="bucket"
				accentColor="emerald"
			/>
			<MetricCard
				label="Objects"
				value={String(metrics.totalObjects)}
				icon="object"
				accentColor="blue"
			/>
			<MetricCard
				label="Storage Used"
				value={formatBytes(metrics.totalStorageBytes)}
				icon="storage"
				accentColor="amber"
			/>
			<MetricCard
				label="Active Keys"
				value="—"
				subtext="Loaded separately"
				icon="key"
				accentColor="rose"
			/>
		</div>

		<!-- Recent Uploads -->
		<div class="rounded-xl border border-surface-800 bg-surface-900">
			<div class="flex items-center justify-between border-b border-surface-800 px-5 py-3.5">
				<h2 class="text-sm font-semibold text-surface-200">Recent Uploads</h2>
				<a
					href="/app/buckets"
					class="text-xs font-medium text-accent-400 transition-colors hover:text-accent-300"
				>
					View all →
				</a>
			</div>

			{#if metrics.recentUploads.length === 0}
				<div class="px-5 py-10 text-center text-sm text-surface-500">No objects uploaded yet</div>
			{:else}
				<div class="divide-y divide-surface-800/50">
					{#each metrics.recentUploads as obj (obj.id)}
						<div
							class="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-850"
						>
							<div class="flex items-center gap-3 overflow-hidden">
								<span class="shrink-0 text-base">{contentTypeIcon(obj.contentType)}</span>
								<div class="overflow-hidden">
									<p class="truncate text-sm font-medium text-surface-200">
										{keyBasename(obj.key)}
									</p>
									<p class="truncate text-xs text-surface-500">
										{obj.bucketName}/{obj.key}
									</p>
								</div>
							</div>
							<div class="ml-4 shrink-0 text-right">
								<p class="text-sm text-surface-400">{formatBytes(obj.size)}</p>
								<p class="text-xs text-surface-600">{timeAgo(obj.createdAt)}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Quick Info -->
		<div class="grid gap-4 sm:grid-cols-2">
			<!-- Server Info -->
			<div class="rounded-xl border border-surface-800 bg-surface-900 p-5">
				<h3 class="mb-3 text-sm font-semibold text-surface-200">Server Connection</h3>
				<div class="space-y-2 text-sm">
					<div class="flex items-center justify-between">
						<span class="text-surface-500">Endpoint</span>
						<code class="rounded bg-surface-800 px-2 py-0.5 text-xs text-surface-300">
							{connection.apiUrl}
						</code>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-surface-500">Mode</span>
						<span class="text-surface-300">
							{connection.useMock ? 'Mock (Dev)' : 'Live'}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-surface-500">Status</span>
						<span class="flex items-center gap-1.5 text-accent-400">
							<span class="inline-block h-1.5 w-1.5 rounded-full bg-accent-500"></span>
							Connected
						</span>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="rounded-xl border border-surface-800 bg-surface-900 p-5">
				<h3 class="mb-3 text-sm font-semibold text-surface-200">Quick Actions</h3>
				<div class="grid grid-cols-2 gap-2">
					<a
						href="/app/buckets"
						class="flex items-center gap-2 rounded-lg bg-surface-800/60 px-3 py-2.5 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-800 hover:text-surface-100"
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
							<ellipse cx="12" cy="5" rx="9" ry="3" />
							<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
						</svg>
						Browse Buckets
					</a>
					<a
						href="/app/keys"
						class="flex items-center gap-2 rounded-lg bg-surface-800/60 px-3 py-2.5 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-800 hover:text-surface-100"
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
							<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
						</svg>
						Manage Keys
					</a>
				</div>
			</div>
		</div>
	{/if}
</div>
