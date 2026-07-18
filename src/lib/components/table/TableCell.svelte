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
	const hasTextSize = $derived.by(() => {
		const classes = className.split(/\s+/);
		const sizeClasses = [
			'xs',
			'sm',
			'base',
			'lg',
			'xl',
			'2xl',
			'3xl',
			'4xl',
			'5xl',
			'6xl',
			'7xl',
			'8xl',
			'9xl'
		];
		return classes.some((cls) => cls.startsWith('text-') && sizeClasses.includes(cls.slice(5)));
	});
	const hasTextColor = $derived.by(() => {
		const classes = className.split(/\s+/);
		return classes.some((cls) => {
			if (!cls.startsWith('text-')) return false;
			const suffix = cls.slice(5);
			const nonColorSuffixes = [
				'xs',
				'sm',
				'base',
				'lg',
				'xl',
				'2xl',
				'3xl',
				'4xl',
				'5xl',
				'6xl',
				'7xl',
				'8xl',
				'9xl',
				'left',
				'center',
				'right',
				'justify',
				'start',
				'end',
				'wrap',
				'nowrap',
				'balance',
				'pretty',
				'clip',
				'ellipsis'
			];
			return !nonColorSuffixes.includes(suffix);
		});
	});
</script>

<td
	class="{hasPaddingX ? '' : 'px-4'} {hasPaddingY ? '' : 'py-2.5'} {hasTextSize
		? ''
		: 'text-xs'} {hasTextColor ? '' : 'text-surface-300'} align-middle {className}"
	{...restProps}
>
	{@render children?.()}
</td>
