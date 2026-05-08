<script lang="ts">
	interface Props {
		label?: string;
		size?: 'sm' | 'md';
		minHeight?: string;
	}

	const { label = 'Loading...', size = 'md', minHeight = '10rem' }: Props = $props();

	const sizeClass = $derived(size === 'sm' ? 'h-4 w-4' : 'h-7 w-7');
</script>

<div class="flex items-center justify-center" style:min-height={minHeight} aria-live="polite">
	<div class="flex items-center gap-3">
		<div
			class="{sizeClass} animate-spin rounded-full border-2 border-surface-700 border-t-accent-500"
		></div>
		<span class="text-sm text-surface-500">{label}</span>
	</div>
</div>
