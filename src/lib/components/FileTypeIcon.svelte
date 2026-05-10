<script lang="ts">
	import {
		ImageIcon,
		VideoIcon,
		MusicIcon,
		FileTextIcon,
		FileIcon,
		FileJsonIcon,
		ArchiveIcon,
		FileSpreadsheetIcon
	} from 'lucide-svelte';

	interface Props {
		type: string;
		size?: number;
		class?: string;
	}

	const { type, size = 16, class: className = '' }: Props = $props();
</script>

{#if type === 'image'}
	<ImageIcon {size} class={className} />
{:else if type === 'video'}
	<VideoIcon {size} class={className} />
{:else if type === 'audio'}
	<MusicIcon {size} class={className} />
{:else if type === 'text'}
	<FileTextIcon {size} class={className} />
{:else if type === 'pdf'}
	<FileSpreadsheetIcon {size} class={className} />
{:else if type === 'json'}
	<FileJsonIcon {size} class={className} />
{:else if type === 'archive'}
	<ArchiveIcon {size} class={className} />
{:else}
	<FileIcon {size} class={className} />
{/if}
