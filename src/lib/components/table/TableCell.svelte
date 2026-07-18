<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLTdAttributes } from 'svelte/elements';

	interface Props extends HTMLTdAttributes {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className = '', ...restProps }: Props = $props();
</script>

<td class="px-4 py-2.5 align-middle text-xs text-surface-300 {className}" {...restProps}>
	{@render children?.()}
</td>
