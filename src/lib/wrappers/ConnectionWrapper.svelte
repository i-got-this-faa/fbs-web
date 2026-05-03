<script lang="ts">
	import { getConnectionContext } from '$lib/stores/connection.svelte';
	import { goto } from '$app/navigation';

	const { children } = $props();

	const connection = getConnectionContext();

	// If not connected after initial restore attempt, redirect to setup
	$effect(() => {
		if (!connection.isConnected && !connection.isConnecting) {
			const timer = setTimeout(() => {
				if (!connection.isConnected && !connection.isConnecting) {
					goto('/setup');
				}
			}, 500);

			return () => clearTimeout(timer);
		}
	});
</script>

{#if connection.isConnected}
	{@render children()}
{:else if connection.isConnecting}
	<div class="flex min-h-screen items-center justify-center bg-surface-950">
		<div class="flex flex-col items-center gap-3">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-surface-700 border-t-accent-500"
			></div>
			<p class="text-sm text-surface-500">Connecting to backend...</p>
		</div>
	</div>
{:else}
	<div class="flex min-h-screen items-center justify-center bg-surface-950">
		<div class="flex flex-col items-center gap-3">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-surface-700 border-t-accent-500"
			></div>
			<p class="text-sm text-surface-500">Checking connection...</p>
		</div>
	</div>
{/if}
