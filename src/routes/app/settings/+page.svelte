<script lang="ts">
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import { getServerContext } from '$lib/stores/server.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	const connection = getConnectionContext();
	const server = getServerContext();

	let confirmingDisconnect = $state(false);
	const implementedS3 = [
		'ListBuckets',
		'CreateBucket',
		'HeadBucket',
		'DeleteBucket empty-only',
		'GetBucketLocation',
		'ListObjectsV1',
		'ListObjectsV2',
		'PutObject',
		'GetObject',
		'HeadObject',
		'DeleteObject',
		'DeleteObjects',
		'CopyObject',
		'Presigned query auth'
	];
	const notImplementedS3 = [
		'Multipart upload',
		'ACL',
		'CORS config endpoints',
		'Bucket policy',
		'Versioning'
	];

	function handleDisconnect() {
		connection.disconnect();
		goto(resolve('/setup'));
	}

	const maskedToken = $derived(
		connection.token
			? connection.token.length > 8
				? connection.token.slice(0, 4) + '····' + connection.token.slice(-4)
				: '····'
			: 'None (dev mode)'
	);

	const connectionMode = $derived(connection.useMock ? 'Mock (Dev)' : 'Live');

	onMount(() => {
		server.loadConfig();
	});
</script>

<svelte:head><title>Settings — FBS</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-6">
	<!-- Connection Details -->
	<div class="rounded-xl border border-surface-800 bg-surface-900 p-5">
		<h2 class="mb-4 text-sm font-semibold text-surface-200">Connection Details</h2>
		<div class="space-y-3 text-sm">
			<div class="flex items-center justify-between">
				<span class="text-surface-500">Endpoint</span>
				<code class="rounded bg-surface-800 px-2 py-0.5 text-xs text-surface-300">
					{connection.apiUrl || '—'}
				</code>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-surface-500">Token</span>
				<code class="rounded bg-surface-800 px-2 py-0.5 text-xs text-surface-300">
					{maskedToken}
				</code>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-surface-500">Mode</span>
				<span class="text-surface-300">{connectionMode}</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-surface-500">Status</span>
				{#if connection.isConnected}
					<span class="flex items-center gap-1.5 text-success-400">
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-success-500"></span>
						Connected
					</span>
				{:else}
					<span class="flex items-center gap-1.5 text-danger-400">
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-danger-500"></span>
						Disconnected
					</span>
				{/if}
			</div>
			{#if connection.error}
				<div
					class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-xs text-danger-400"
				>
					{connection.error}
				</div>
			{/if}
			{#if server.error}
				<div
					class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-xs text-danger-400"
				>
					{server.error}
				</div>
			{/if}
		</div>
	</div>

	<!-- Server Config -->
	<div class="rounded-xl border border-surface-800 bg-surface-900 p-5">
		<h2 class="mb-4 text-sm font-semibold text-surface-200">Server</h2>
		{#if server.isLoadingConfig && !server.config}
			<p class="text-sm text-surface-500">Loading server config...</p>
		{:else if server.config}
			<div class="space-y-3 text-sm">
				<div class="flex items-center justify-between gap-3">
					<span class="text-surface-500">Region</span>
					<span class="text-surface-300">{server.config.region}</span>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span class="text-surface-500">Public base URL</span>
					<code class="truncate rounded bg-surface-800 px-2 py-0.5 text-xs text-surface-300">
						{server.config.publicBaseUrl}
					</code>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span class="text-surface-500">Dev mode</span>
					<span class="text-surface-300">{server.config.devMode ? 'Enabled' : 'Disabled'}</span>
				</div>
				<div class="mt-4 grid gap-3 sm:grid-cols-2">
					<div class="rounded-lg border border-surface-800 bg-surface-950/60 p-3">
						<p class="text-xs text-surface-500">S3 max keys</p>
						<p class="mt-1 text-sm font-medium text-surface-200">
							{server.config.limits.s3MaxKeys.toLocaleString()}
						</p>
					</div>
					<div class="rounded-lg border border-surface-800 bg-surface-950/60 p-3">
						<p class="text-xs text-surface-500">S3 delete objects</p>
						<p class="mt-1 text-sm font-medium text-surface-200">
							{server.config.limits.s3DeleteObjects.toLocaleString()}
						</p>
					</div>
					<div class="rounded-lg border border-surface-800 bg-surface-950/60 p-3">
						<p class="text-xs text-surface-500">Management object list limit</p>
						<p class="mt-1 text-sm font-medium text-surface-200">
							{server.config.limits.managementObjectListLimit.toLocaleString()}
						</p>
					</div>
					<div class="rounded-lg border border-surface-800 bg-surface-950/60 p-3">
						<p class="text-xs text-surface-500">Management activity limit</p>
						<p class="mt-1 text-sm font-medium text-surface-200">
							{server.config.limits.managementActivityLimit.toLocaleString()}
						</p>
					</div>
				</div>
			</div>
		{:else}
			<p class="text-sm text-surface-500">Server config is unavailable.</p>
		{/if}
	</div>

	<!-- Compatibility -->
	<div class="rounded-xl border border-surface-800 bg-surface-900 p-5">
		<h2 class="mb-4 text-sm font-semibold text-surface-200">S3 Compatibility</h2>
		<div class="grid gap-4 md:grid-cols-2">
			<div>
				<h3 class="mb-2 text-xs font-medium tracking-wide text-success-400 uppercase">
					Implemented
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each implementedS3 as item (item)}
						<span
							class="rounded-md border border-success-500/20 bg-success-500/10 px-2 py-1 text-xs text-success-300"
						>
							{item}
						</span>
					{/each}
				</div>
			</div>
			<div>
				<h3 class="mb-2 text-xs font-medium tracking-wide text-surface-500 uppercase">
					Not implemented
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each notImplementedS3 as item (item)}
						<span
							class="rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-xs text-surface-400"
						>
							{item}
						</span>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- Storage Info -->
	<div class="rounded-xl border border-surface-800 bg-surface-900 p-5">
		<h2 class="mb-3 text-sm font-semibold text-surface-200">Storage</h2>
		<p class="text-sm text-surface-400">
			Connection credentials are stored in <code
				class="rounded bg-surface-800 px-1.5 py-0.5 text-xs text-surface-300">localStorage</code
			>.
		</p>
		<p class="mt-2 text-xs text-surface-500">
			Clearing your browser data or using private/incognito mode will remove saved credentials. You
			will need to reconnect after clearing.
		</p>
	</div>

	<!-- Danger Zone -->
	<div class="rounded-xl border border-danger-500/20 bg-surface-900 p-5">
		<h2 class="mb-3 text-sm font-semibold text-danger-400">Danger Zone</h2>

		{#if confirmingDisconnect}
			<div class="rounded-lg border border-danger-500/20 bg-danger-500/5 p-4">
				<p class="mb-3 text-sm text-surface-300">
					Are you sure you want to disconnect? Your saved credentials will be removed and you will
					be redirected to the setup page.
				</p>
				<div class="flex gap-2">
					<button
						onclick={handleDisconnect}
						class="rounded-lg bg-danger-500/15 px-4 py-2 text-sm font-medium text-danger-400 transition-colors hover:bg-danger-500/25"
					>
						Yes, Disconnect
					</button>
					<button
						onclick={() => (confirmingDisconnect = false)}
						class="rounded-lg bg-surface-800 px-4 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-700"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-surface-300">Disconnect from server</p>
					<p class="mt-0.5 text-xs text-surface-500">
						Removes stored credentials and returns to setup.
					</p>
				</div>
				<button
					onclick={() => (confirmingDisconnect = true)}
					class="rounded-lg bg-danger-500/15 px-4 py-2 text-sm font-medium text-danger-400 transition-colors hover:bg-danger-500/25"
				>
					Disconnect
				</button>
			</div>
		{/if}
	</div>
</div>
