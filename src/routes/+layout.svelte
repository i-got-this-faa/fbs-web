<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { setConnectionContext } from '$lib/stores/connection.svelte';

	let { children } = $props();

	// Set connection context at the root level so ALL routes share it
	setConnectionContext();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>FBS Dashboard</title>
</svelte:head>

{@render children()}
