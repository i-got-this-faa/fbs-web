<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import Logo from '$lib/components/Logo.svelte';

	const connection = getConnectionContext();

	let apiUrl = $state('');
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
			setTimeout(() => goto(resolve('/app'), { replaceState: true }), 600);
		} else {
			testResult = { ok: false, message: connection.error ?? 'Connection failed' };
		}

		isTestingConnection = false;
	}

	function handleMockConnect() {
		connection.connectMock();
		goto(resolve('/app'), { replaceState: true });
	}
</script>

<svelte:head>
	<title>FBS — Connect to Backend</title>
</svelte:head>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-950 px-4 py-10"
>
	<div class="setup-pattern" aria-hidden="true"></div>
	<div
		class="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_28rem] lg:gap-16"
	>
		<!-- Logo & Header -->
		<div class="mx-auto w-full max-w-md text-center lg:mx-0 lg:text-left">
			<div class="mb-5 flex items-center justify-center gap-4 lg:justify-start">
				<div class="h-16 w-16 overflow-hidden rounded-2xl">
					<Logo />
				</div>
				<h1 class="text-3xl font-bold tracking-tight text-surface-100 sm:text-4xl">FBS</h1>
			</div>
			<p class="mt-3 max-w-sm text-sm leading-6 text-surface-500">
				Connect to your storage backend and manage buckets, objects, keys, and activity from one
				dashboard.
			</p>
		</div>

		<div class="mx-auto w-full max-w-md lg:mx-0">
			<!-- Connection Form -->
			<form
				onsubmit={handleConnect}
				class="rounded-xl border border-surface-800 bg-surface-900 p-6"
			>
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
							placeholder="https://your-fbs-server.com"
							class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-sm text-surface-100 placeholder-surface-600 transition-colors outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
						/>
						<p class="mt-1 text-xs text-surface-600">The public URL of your FBS server.</p>
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
							Local server using <code class="rounded bg-surface-800 px-1 py-0.5 text-surface-400"
								>--dev</code
							>? Leave this empty.
						</p>
					</div>
				</div>

				<!-- Result message -->
				{#if testResult}
					<div
						class="mt-4 rounded-lg px-3.5 py-2.5 text-sm
						{testResult.ok ? 'bg-success-500/10 text-success-400' : 'bg-danger-500/10 text-danger-400'}"
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
				Use Demo Data
			</button>
		</div>
	</div>
</div>
