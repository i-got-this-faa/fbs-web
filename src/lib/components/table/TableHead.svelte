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
