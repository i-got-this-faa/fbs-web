<script lang="ts">
	interface Props {
		open: boolean;
		title: string;
		description?: string;
		confirmLabel?: string;
		destructive?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}

	const {
		open,
		title,
		description,
		confirmLabel = 'Confirm',
		destructive = false,
		onconfirm,
		oncancel
	}: Props = $props();
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') oncancel();
	}}
/>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-dialog-title"
	>
		<!-- Overlay -->
		<button
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={oncancel}
			aria-label="Close dialog"
			tabindex="-1"
		></button>

		<!-- Dialog -->
		<div
			class="relative z-10 w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl shadow-black/40"
		>
			<h2 id="confirm-dialog-title" class="text-base font-semibold text-surface-100">
				{title}
			</h2>
			{#if description}
				<p class="mt-2 text-sm text-surface-400">{description}</p>
			{/if}

			<div class="mt-6 flex items-center justify-end gap-3">
				<button
					onclick={oncancel}
					class="rounded-lg px-4 py-2 text-sm font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
				>
					Cancel
				</button>
				<button
					onclick={onconfirm}
					class="rounded-lg px-4 py-2 text-sm font-medium transition-colors
						{destructive
						? 'bg-danger-500/15 text-danger-400 hover:bg-danger-500/25'
						: 'bg-accent-500/15 text-accent-400 hover:bg-accent-500/25'}"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
