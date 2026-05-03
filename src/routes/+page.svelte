<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Redirect to /app (or /setup if not connected — handled by ConnectionWrapper)
	onMount(() => {
		const saved = localStorage.getItem('fbs_connection');
		if (saved) {
			goto('/app', { replaceState: true });
		} else {
			goto('/setup', { replaceState: true });
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-surface-950">
	<div class="flex flex-col items-center gap-3">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-surface-700 border-t-accent-500"
		></div>
	</div>
</div>
