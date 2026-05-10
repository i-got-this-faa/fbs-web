<script lang="ts">
	import type { Snippet } from 'svelte';
	import { FolderOpenIcon } from 'lucide-svelte';

	interface Props {
		icon?: typeof FolderOpenIcon | string;
		title: string;
		description?: string;
		action?: Snippet;
	}

	const { icon = FolderOpenIcon, title, description, action }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
	<div class="mb-4 text-surface-500 opacity-40">
		{#if typeof icon === 'string'}
			<span class="text-4xl">{icon}</span>
		{:else}
			{@const Icon = icon}
			<Icon size={40} />
		{/if}
	</div>
	<h3 class="mb-1 text-sm font-medium text-surface-300">{title}</h3>
	{#if description}
		<p class="mb-4 max-w-sm text-xs text-surface-500">{description}</p>
	{/if}
	{#if action}
		{@render action()}
	{/if}
</div>
