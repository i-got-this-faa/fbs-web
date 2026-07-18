<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLTableRowElement> {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className = '', ...restProps }: Props = $props();
</script>

<tr class="transition-colors hover:bg-surface-850/30 {className}" {...restProps}>
	{@render children?.()}
</tr>
