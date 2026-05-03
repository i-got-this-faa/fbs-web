<script lang="ts">
	interface Props {
		label: string;
		value: string;
		subtext?: string;
		icon?: 'bucket' | 'object' | 'storage' | 'key';
		accentColor?: 'emerald' | 'blue' | 'amber' | 'rose';
	}

	const { label, value, subtext, icon = 'bucket', accentColor = 'emerald' }: Props = $props();

	const colorMap = {
		emerald: { bg: 'bg-accent-500/10', text: 'text-accent-400', ring: 'ring-accent-500/20' },
		blue: { bg: 'bg-info-500/10', text: 'text-info-400', ring: 'ring-info-500/20' },
		amber: { bg: 'bg-warning-500/10', text: 'text-warning-400', ring: 'ring-warning-500/20' },
		rose: { bg: 'bg-danger-500/10', text: 'text-danger-400', ring: 'ring-danger-500/20' }
	};

	const colors = $derived(colorMap[accentColor]);
</script>

<div
	class="group relative overflow-hidden rounded-xl border border-surface-800 bg-surface-900 p-5 transition-all duration-200 hover:border-surface-700 hover:shadow-lg hover:shadow-black/20"
>
	<!-- Subtle gradient glow -->
	<div
		class="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 {colors.bg}"
	></div>

	<div class="relative flex items-start justify-between">
		<div class="space-y-2">
			<p class="text-xs font-medium tracking-wider text-surface-500 uppercase">{label}</p>
			<p class="text-2xl font-bold tracking-tight text-surface-100">{value}</p>
			{#if subtext}
				<p class="text-xs text-surface-500">{subtext}</p>
			{/if}
		</div>

		<!-- Icon -->
		<div
			class="flex h-10 w-10 items-center justify-center rounded-lg {colors.bg} ring-1 {colors.ring}"
		>
			<span class={colors.text}>
				{#if icon === 'bucket'}
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<ellipse cx="12" cy="5" rx="9" ry="3" />
						<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
						<path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
					</svg>
				{:else if icon === 'object'}
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
						<polyline points="14 2 14 8 20 8" />
					</svg>
				{:else if icon === 'storage'}
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
						<rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
						<line x1="6" y1="6" x2="6.01" y2="6" />
						<line x1="6" y1="18" x2="6.01" y2="18" />
					</svg>
				{:else if icon === 'key'}
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
						/>
					</svg>
				{/if}
			</span>
		</div>
	</div>
</div>
