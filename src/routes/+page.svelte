<script lang="ts">
	import TeamManager from '$lib/components/TeamManager.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import WorkPackagesTable from '$lib/components/WorkPackagesTable.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';

	let activeTab = $state<'board' | 'workPackages' | 'teams'>('board');
</script>

<ErrorBanner />

<div class="min-h-screen bg-gray-100">
	<header class="bg-white shadow">
		<div class="mx-auto max-w-7xl px-4 py-6">
			<h1 class="text-3xl font-bold text-gray-900">Capacity Planning</h1>
			<p class="mt-1 text-sm text-gray-600">
				Plan work packages across teams with capacity-based forecasting
			</p>

			<!-- Tab Navigation -->
			<div class="mt-4 border-b border-gray-200">
				<nav class="-mb-px flex space-x-8">
					<button
						onclick={() => (activeTab = 'board')}
						class="whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'board'
							? 'border-blue-500 text-blue-600'
							: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					>
						Board
					</button>
					<button
						onclick={() => (activeTab = 'workPackages')}
						class="whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium {activeTab ===
						'workPackages'
							? 'border-blue-500 text-blue-600'
							: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					>
						Work Packages
					</button>
					<button
						onclick={() => (activeTab = 'teams')}
						class="whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'teams'
							? 'border-blue-500 text-blue-600'
							: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					>
						Teams
					</button>
				</nav>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-8">
		{#if activeTab === 'board'}
			<KanbanBoard />
		{:else if activeTab === 'workPackages'}
			<WorkPackagesTable />
		{:else}
			<TeamManager />
		{/if}
	</main>
</div>
