<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLTableRowElement> {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className = '', ...restProps }: Props = $props();
	const hasHoverClass = $derived(className.includes('hover:bg-'));
</script>

<tr
	class="transition-colors {hasHoverClass ? '' : 'hover:bg-surface-850/30'} {className}"
	{...restProps}
>
	{@render children?.()}
</tr>
