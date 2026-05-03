<script lang="ts">
</script>

<svelte:head>
	<title>Dashboard — FBS</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6">
	<!-- Quick Actions -->
	<div class="grid gap-4 sm:grid-cols-2">
		<a
			href="/app/buckets"
			class="group rounded-xl border border-surface-800 bg-surface-900 p-5 transition-all duration-150 hover:border-surface-700 hover:shadow-lg hover:shadow-black/20"
		>
			<div class="flex items-center gap-4">
				<div
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400 ring-1 ring-accent-500/20"
				>
					<svg
						width="22"
						height="22"
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
				</div>
				<div>
					<p class="text-sm font-semibold text-surface-200 group-hover:text-surface-100">
						Browse Buckets
					</p>
					<p class="mt-0.5 text-xs text-surface-500">
						Create, browse, and manage your storage buckets
					</p>
				</div>
			</div>
		</a>

		<a
			href="/app/keys"
			class="group rounded-xl border border-surface-800 bg-surface-900 p-5 transition-all duration-150 hover:border-surface-700 hover:shadow-lg hover:shadow-black/20"
		>
			<div class="flex items-center gap-4">
				<div
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-info-500/10 text-info-400 ring-1 ring-info-500/20"
				>
					<svg
						width="22"
						height="22"
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
				</div>
				<div>
					<p class="text-sm font-semibold text-surface-200 group-hover:text-surface-100">
						Access Keys
					</p>
					<p class="mt-0.5 text-xs text-surface-500">Manage S3 API authentication keys</p>
				</div>
			</div>
		</a>
	</div>

	<!-- Metrics placeholder -->
	<div class="rounded-xl border border-dashed border-surface-700 bg-surface-900/30 p-8">
		<div class="flex flex-col items-center text-center">
			<div class="mb-3 text-3xl opacity-30">📊</div>
			<p class="text-sm font-medium text-surface-400">Dashboard Metrics</p>
			<p class="mt-1 max-w-sm text-xs text-surface-600">
				Storage usage, object counts, and recent activity will appear here once the Management API
				is available.
			</p>
		</div>
	</div>
</div>
