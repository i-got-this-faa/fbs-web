<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import FileTypeIcon from '$lib/components/FileTypeIcon.svelte';
	import type { ObjectMetadata } from '$lib/types/api';
	import { formatBytes, formatDate, contentTypeIconName } from '$lib/utils/format';

	interface Props {
		open: boolean;
		metadata: ObjectMetadata | null;
		isLoading: boolean;
		onclose: () => void;
		ondownload: () => void;
	}

	const { open, metadata, isLoading, onclose, ondownload }: Props = $props();
</script>

<Modal {open} title="Object Details" {onclose}>
	{#if isLoading}
		<LoadingSpinner label="Loading metadata…" />
	{:else if metadata}
		<dl class="divide-y divide-surface-800/50">
			<div class="py-3">
				<dt class="text-xs font-medium tracking-wider text-surface-500 uppercase">Key</dt>
				<dd class="mt-1 text-sm break-all text-surface-200">{metadata.key}</dd>
			</div>

			<div class="py-3">
				<dt class="text-xs font-medium tracking-wider text-surface-500 uppercase">Bucket</dt>
				<dd class="mt-1 text-sm text-surface-200">{metadata.bucketName}</dd>
			</div>

			<div class="py-3">
				<dt class="text-xs font-medium tracking-wider text-surface-500 uppercase">Size</dt>
				<dd class="mt-1 text-sm text-surface-200">{formatBytes(metadata.size)}</dd>
			</div>

			<div class="py-3">
				<dt class="text-xs font-medium tracking-wider text-surface-500 uppercase">Content Type</dt>
				<dd class="mt-1 flex items-center gap-2 text-sm text-surface-200">
					<FileTypeIcon type={contentTypeIconName(metadata.contentType)} size={16} />
					{metadata.contentType}
				</dd>
			</div>

			<div class="py-3">
				<dt class="text-xs font-medium tracking-wider text-surface-500 uppercase">ETag</dt>
				<dd class="mt-1 font-mono text-sm text-surface-200">{metadata.etag}</dd>
			</div>

			<div class="py-3">
				<dt class="text-xs font-medium tracking-wider text-surface-500 uppercase">Last Modified</dt>
				<dd class="mt-1 text-sm text-surface-200">{formatDate(metadata.lastModified)}</dd>
			</div>
		</dl>

		<div class="flex justify-end gap-3 pt-4">
			<button
				type="button"
				onclick={onclose}
				class="rounded-lg px-4 py-2 text-sm font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
			>
				Close
			</button>
			<button
				type="button"
				onclick={ondownload}
				class="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/25"
			>
				Download
			</button>
		</div>
	{/if}
</Modal>
