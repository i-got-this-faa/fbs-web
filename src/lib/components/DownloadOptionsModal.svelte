<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import type { StorageObject } from '$lib/types/api';

	interface Props {
		open: boolean;
		object: StorageObject | null;
		onclose: () => void;
		ongeneratelink: (expiresIn: number) => Promise<string>;
	}

	const { open, object, onclose, ongeneratelink }: Props = $props();

	// Duration in seconds. Presets cover common values; Custom lets you type anything.
	const PRESETS: { label: string; seconds: number }[] = [
		{ label: '1h', seconds: 3600 },
		{ label: '6h', seconds: 21600 },
		{ label: '24h', seconds: 86400 },
		{ label: '7d', seconds: 604_800 },
		{ label: '30d', seconds: 2_592_000 },
		{ label: '1y', seconds: 31_536_000 },
		{ label: '10y', seconds: 315_360_000 },
		{ label: '100y', seconds: 3_153_600_000 }
	];
	const DURATION_UNITS = [
		{ label: 'Minutes', multiplier: 60 },
		{ label: 'Hours', multiplier: 3600 },
		{ label: 'Days', multiplier: 86_400 },
		{ label: 'Years', multiplier: 31_536_000 }
	] as const;

	let expiresIn = $state(3600);
	let usingCustom = $state(false);
	let customValue = $state(1);
	let customUnit = $state<number>(3600);
	let copied = $state(false);
	let isGenerating = $state(false);
	let errorMessage = $state<string | null>(null);

	let effectiveSeconds = $derived(usingCustom ? customValue * customUnit : expiresIn);

	function pickPreset(seconds: number) {
		expiresIn = seconds;
		usingCustom = false;
	}

	function switchToCustom() {
		// Seed the custom fields from the current duration
		customValue = 1;
		customUnit = 3600;
		for (const u of DURATION_UNITS) {
			if (expiresIn % u.multiplier === 0 && expiresIn / u.multiplier < 1_000_000) {
				customValue = Math.round(expiresIn / u.multiplier);
				customUnit = u.multiplier;
				break;
			}
		}
		usingCustom = true;
	}

	$effect(() => {
		if (open) {
			expiresIn = 3600;
			usingCustom = false;
			copied = false;
			isGenerating = false;
			errorMessage = null;
		}
	});

	async function handleCopyLink() {
		errorMessage = null;
		isGenerating = true;
		try {
			const url = await ongeneratelink(effectiveSeconds);
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to generate link';
		} finally {
			isGenerating = false;
		}
	}
</script>

<Modal {open} title="Copy Signed Link" {onclose}>
	{#if object}
		<div class="space-y-4">
			<div>
				<p class="text-xs font-semibold tracking-wider text-surface-500 uppercase">Object</p>
				<p class="mt-1 text-sm font-medium break-all text-surface-200">{object.key}</p>
			</div>

			<div class="space-y-3">
				<label
					for="download-expiry"
					class="block text-xs font-semibold tracking-wider text-surface-500 uppercase"
				>
					Link Expiration Duration
				</label>

				<!-- Preset chips -->
				<div class="flex flex-wrap gap-1.5">
					{#each PRESETS as preset (preset.label)}
						<button
							type="button"
							onclick={() => pickPreset(preset.seconds)}
							class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors
								{!usingCustom && expiresIn === preset.seconds
								? 'bg-accent-500/20 text-accent-300 ring-1 ring-accent-500/40'
								: 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-surface-200'}"
						>
							{preset.label}
						</button>
					{/each}
					<button
						type="button"
						onclick={switchToCustom}
						class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors
							{usingCustom
							? 'bg-accent-500/20 text-accent-300 ring-1 ring-accent-500/40'
							: 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-surface-200'}"
					>
						Custom
					</button>
				</div>

				<!-- Custom duration fields -->
				{#if usingCustom}
					<div class="flex items-center gap-2">
						<input
							type="number"
							id="download-expiry"
							min="1"
							bind:value={customValue}
							class="w-24 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
						/>
						<select
							bind:value={customUnit}
							class="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-100 outline-none focus:border-accent-500"
						>
							{#each DURATION_UNITS as unit (unit.label)}
								<option value={unit.multiplier}>{unit.label}</option>
							{/each}
						</select>
						<span class="text-xs whitespace-nowrap text-surface-500">
							(= {effectiveSeconds.toLocaleString()}s)
						</span>
					</div>
				{/if}

				<p class="text-xs text-surface-600">
					All download links require a signed URL. Selecting a duration longer than the server's
					limit will automatically fall back to the maximum allowed lifetime.
				</p>
			</div>

			{#if errorMessage}
				<p
					class="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-xs text-danger-400"
				>
					{errorMessage}
				</p>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={onclose}
					class="rounded-lg px-4 py-2 text-sm font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleCopyLink}
					disabled={isGenerating}
					class="min-w-[100px] rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25 disabled:opacity-50"
				>
					{#if isGenerating}
						Generating…
					{:else if copied}
						Copied!
					{:else}
						Copy Link
					{/if}
				</button>
			</div>
		</div>
	{/if}
</Modal>
