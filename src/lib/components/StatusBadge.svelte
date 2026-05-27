<script lang="ts">
	interface Props {
		status: 'active' | 'inactive' | 'connected' | 'disconnected' | 'mock';
	}

	const { status }: Props = $props();

	const config = $derived.by(() => {
		switch (status) {
			case 'active':
			case 'connected':
				return {
					label: status,
					bg: 'bg-success-500/15',
					text: 'text-success-400',
					dot: 'bg-success-500'
				};
			case 'inactive':
			case 'disconnected':
				return {
					label: status,
					bg: 'bg-danger-500/15',
					text: 'text-danger-400',
					dot: 'bg-danger-500'
				};
			case 'mock':
				return {
					label: 'mock',
					bg: 'bg-warning-500/15',
					text: 'text-warning-400',
					dot: 'bg-warning-500'
				};
		}
	});
</script>

<span
	class="inline-flex w-fit items-center gap-1.5 justify-self-start rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize {config.bg} {config.text}"
>
	<span class="inline-block h-1.5 w-1.5 rounded-full {config.dot}"></span>
	{config.label}
</span>
