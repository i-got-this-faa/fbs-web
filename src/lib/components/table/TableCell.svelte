<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLTdAttributes } from 'svelte/elements';

	interface Props extends HTMLTdAttributes {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className = '', ...restProps }: Props = $props();

	const hasPaddingY = $derived(className.includes('py-'));
	const hasPaddingX = $derived(
		className.includes('px-') || className.includes('pl-') || className.includes('pr-')
	);
	const hasTextSize = $derived(className.includes('text-'));
	const hasTextColor = $derived(className.includes('text-surface-'));
</script>

<td
	class="{hasPaddingX ? '' : 'px-4'} {hasPaddingY ? '' : 'py-2.5'} {hasTextSize
		? ''
		: 'text-xs'} {hasTextColor ? '' : 'text-surface-300'} align-middle {className}"
	{...restProps}
>
	{@render children?.()}
</td>
