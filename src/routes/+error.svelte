<script lang="ts">
	import { page } from '$app/state';
	import PageError from '$lib/components/PageError.svelte';
</script>

<svelte:head>
	<title>Error — FBS</title>
</svelte:head>

<PageError error={page.error} />
