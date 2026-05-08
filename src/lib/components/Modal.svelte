<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		children: Snippet;
		onclose: () => void;
	}

	const { open, title, description, children, onclose }: Props = $props();
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') onclose();
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<button
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={onclose}
			aria-label="Close modal"
			tabindex="-1"
		></button>

		<div
			class="relative z-10 w-full max-w-lg rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl shadow-black/40"
		>
			<div class="mb-5 flex items-start justify-between gap-4">
				<div>
					<h2 id="modal-title" class="text-base font-semibold text-surface-100">{title}</h2>
					{#if description}
						<p class="mt-1 text-sm text-surface-500">{description}</p>
					{/if}
				</div>
				<button
					onclick={onclose}
					class="rounded-md p-1.5 text-surface-500 hover:bg-surface-800 hover:text-surface-200"
					aria-label="Close modal"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			</div>

			{@render children()}
		</div>
	</div>
{/if}
