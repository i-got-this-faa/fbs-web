<script lang="ts">
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import { goto } from '$app/navigation';

	const connection = getConnectionContext();

	let confirmingDisconnect = $state(false);

	function handleDisconnect() {
		connection.disconnect();
		goto('/setup');
	}

	const maskedToken = $derived(
		connection.token.length > 8
			? connection.token.slice(0, 4) + '····' + connection.token.slice(-4)
			: '····'
	);

	const connectionMode = $derived(connection.useMock ? 'Mock (Dev)' : 'Live');
</script>

<svelte:head><title>Settings — FBS</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-lg font-semibold tracking-tight text-surface-100">Settings</h1>
		<p class="mt-0.5 text-sm text-surface-500">Manage your connection and preferences</p>
	</div>

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
					<span class="flex items-center gap-1.5 text-accent-400">
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-accent-500"></span>
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
