<script lang="ts">
	import ConnectionWrapper from '$lib/wrappers/ConnectionWrapper.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { setBucketsContext } from '$lib/stores/buckets.svelte';
	import { setObjectsContext } from '$lib/stores/objects.svelte';

	const { children } = $props();

	let sidebarOpen = $state(false);

	// Set store contexts for all /app routes
	setBucketsContext();
	setObjectsContext();
</script>

<svelte:head>
	<title>FBS Dashboard</title>
</svelte:head>

<ConnectionWrapper>
	<div class="flex h-screen overflow-hidden bg-surface-950">
		<!-- Desktop sidebar (always visible at md+) -->
		<div class="hidden md:block">
			<Sidebar />
		</div>

		<!-- Mobile sidebar overlay -->
		{#if sidebarOpen}
			<div class="fixed inset-0 z-40 md:hidden">
				<!-- Backdrop -->
				<button
					class="absolute inset-0 bg-black/60 backdrop-blur-sm"
					onclick={() => (sidebarOpen = false)}
					aria-label="Close sidebar"
					tabindex="-1"
				></button>
				<!-- Drawer -->
				<div class="relative z-10 h-full w-56">
					<Sidebar onnavigate={() => (sidebarOpen = false)} />
				</div>
			</div>
		{/if}

		<div class="flex flex-1 flex-col overflow-hidden">
			<TopBar onmenutoggle={() => (sidebarOpen = !sidebarOpen)} />
			<main class="flex-1 overflow-y-auto p-4 md:p-6">
				{@render children()}
			</main>
		</div>
	</div>
</ConnectionWrapper>
