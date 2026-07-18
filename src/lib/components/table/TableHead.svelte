<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLThAttributes } from 'svelte/elements';

	interface Props extends HTMLThAttributes {
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

<th
	class="sticky top-0 z-10 border-b border-surface-800 bg-surface-900 font-semibold tracking-wider uppercase {hasPaddingX
		? ''
		: 'px-4'} {hasPaddingY ? '' : 'py-2.5'} {hasTextSize ? '' : 'text-xs'} {hasTextColor
		? ''
		: 'text-surface-500'} {className}"
	{...restProps}
>
	{@render children?.()}
</th>
