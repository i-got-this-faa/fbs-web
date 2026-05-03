<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		icon?: string;
		title: string;
		description?: string;
		action?: Snippet;
	}

	const { icon = '📂', title, description, action }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
	<div class="mb-4 text-4xl opacity-40">{icon}</div>
	<h3 class="mb-1 text-sm font-medium text-surface-300">{title}</h3>
	{#if description}
		<p class="mb-4 max-w-sm text-xs text-surface-500">{description}</p>
	{/if}
	{#if action}
		{@render action()}
	{/if}
</div>
