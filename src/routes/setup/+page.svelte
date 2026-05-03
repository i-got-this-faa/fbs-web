<script lang="ts">
	import { goto } from '$app/navigation';
	import { getConnectionContext } from '$lib/stores/connection.svelte';

	const connection = getConnectionContext();

	let apiUrl = $state('http://localhost:9000');
	let token = $state('');
	let isTestingConnection = $state(false);
	let testResult = $state<{ ok: boolean; message: string } | null>(null);

	async function handleConnect(e: Event) {
		e.preventDefault();
		isTestingConnection = true;
		testResult = null;

		await connection.connect(apiUrl, token);

		if (connection.isConnected) {
			testResult = { ok: true, message: 'Connected successfully!' };
			setTimeout(() => goto('/app', { replaceState: true }), 600);
		} else {
			testResult = { ok: false, message: connection.error ?? 'Connection failed' };
		}

		isTestingConnection = false;
	}

	function handleMockConnect() {
		connection.connectMock();
		goto('/app', { replaceState: true });
	}
</script>

<svelte:head>
	<title>FBS — Connect to Backend</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-950 px-4">
	<div class="w-full max-w-md">
		<!-- Logo & Header -->
		<div class="mb-8 text-center">
			<div
				class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/10 ring-1 ring-accent-500/20"
			>
				<svg
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-accent-400"
				>
					<path
						d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
					/>
					<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
					<line x1="12" y1="22.08" x2="12" y2="12" />
				</svg>
			</div>
			<h1 class="text-xl font-bold tracking-tight text-surface-100">FBS Dashboard</h1>
			<p class="mt-1 text-sm text-surface-500">Connect to your storage backend</p>
		</div>

		<!-- Connection Form -->
		<form onsubmit={handleConnect} class="rounded-xl border border-surface-800 bg-surface-900 p-6">
			<div class="space-y-4">
				<div>
					<label for="api-url" class="mb-1.5 block text-sm font-medium text-surface-300"
						>Backend URL</label
					>
					<input
						id="api-url"
						type="url"
						bind:value={apiUrl}
						required
						placeholder="http://localhost:9000"
						class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-sm text-surface-100 placeholder-surface-600 transition-colors outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
					/>
					<p class="mt-1 text-xs text-surface-600">
						The URL of your fbs-core server (e.g. http://localhost:9000)
					</p>
				</div>

				<div>
					<label for="token" class="mb-1.5 block text-sm font-medium text-surface-300"
						>Bearer Token</label
					>
					<input
						id="token"
						type="password"
						bind:value={token}
						placeholder="Enter your admin token"
						class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-sm text-surface-100 placeholder-surface-600 transition-colors outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
					/>
					<p class="mt-1 text-xs text-surface-600">
						Leave empty if running in <code
							class="rounded bg-surface-800 px-1 py-0.5 text-surface-400">--dev</code
						> mode
					</p>
				</div>
			</div>

			<!-- Result message -->
			{#if testResult}
				<div
					class="mt-4 rounded-lg px-3.5 py-2.5 text-sm
						{testResult.ok ? 'bg-accent-500/10 text-accent-400' : 'bg-danger-500/10 text-danger-400'}"
				>
					{testResult.message}
				</div>
			{/if}

			<!-- Submit -->
			<button
				type="submit"
				disabled={isTestingConnection || !apiUrl}
				class="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500/15 px-4 py-2.5 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{#if isTestingConnection}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-accent-400/30 border-t-accent-400"
					></div>
					Connecting...
				{:else}
					Connect
				{/if}
			</button>
		</form>

		<!-- Divider -->
		<div class="my-5 flex items-center gap-3">
			<div class="h-px flex-1 bg-surface-800"></div>
			<span class="text-xs text-surface-600">or</span>
			<div class="h-px flex-1 bg-surface-800"></div>
		</div>

		<!-- Mock Mode -->
		<button
			onclick={handleMockConnect}
			class="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-800 bg-surface-900 px-4 py-2.5 text-sm font-medium text-surface-400 transition-colors hover:border-surface-700 hover:text-surface-300"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path
					d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
				/>
			</svg>
			Use Mock Data (Dev Mode)
		</button>
		<p class="mt-2 text-center text-xs text-surface-600">
			Explore the dashboard with sample data — no backend required
		</p>
	</div>
</div>
