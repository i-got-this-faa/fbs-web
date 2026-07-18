<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLTableAttributes } from 'svelte/elements';

	interface Props extends HTMLTableAttributes {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className = '', ...restProps }: Props = $props();
</script>

<table class="w-full border-collapse text-left text-xs {className}" {...restProps}>
	{@render children?.()}
</table>
