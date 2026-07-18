<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLTableSectionElement> {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className = '', ...restProps }: Props = $props();
	const hasDivide = $derived(className.includes('divide-'));
</script>

<tbody
	class="{hasDivide ? '' : 'divide-y divide-surface-850'} bg-surface-900/50 {className}"
	{...restProps}
>
	{@render children?.()}
</tbody>
