<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLThAttributes } from 'svelte/elements';

	interface Props extends HTMLThAttributes {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className = '', ...restProps }: Props = $props();
</script>

<th
	class="sticky top-0 z-10 border-b border-surface-800 bg-surface-900 px-4 py-2.5 text-xs font-semibold tracking-wider text-surface-500 uppercase {className}"
	{...restProps}
>
	{@render children?.()}
</th>
