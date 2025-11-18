<script lang="ts">
	import { page } from '$app/stores';
	import { optimistikit } from 'optimistikit';
	import { enhance as svelteKitEnhance } from '$app/forms';
	import TeamManager from '$lib/components/TeamManager.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import WorkPackagesTable from '$lib/components/WorkPackagesTable.svelte';
	import { appState } from '$lib/stores/appState';

	let activeTab = $state<'board' | 'workPackages' | 'teams'>('board');
	let errorMessage = $state<string>('');

	// Wrap page data with optimistikit() to enable optimistic updates
	const { data: optimisticData, enhance: optimisticEnhance } = optimistikit(
		() => $page.data,
		{
			key: 'planning-data',
			enhance: svelteKitEnhance
		}
	);

	// Initialize appState from server data
	$effect(() => {
		if (optimisticData.initialState) {
			appState.set(optimisticData.initialState);
		}
	});

	// Export error handler for components to use
	export function handleFormError(error: string) {
		errorMessage = error;
	}

	export function clearError() {
		errorMessage = '';
	}
</script>

<div class="min-h-screen bg-gray-100">
	<header class="bg-white shadow">
		<div class="mx-auto max-w-7xl px-4 py-6">
			<h1 class="text-3xl font-bold text-gray-900">Capacity Planning</h1>
			<p class="mt-1 text-sm text-gray-600">
				Plan work packages across teams with capacity-based forecasting
			</p>

			<!-- Error Banner -->
			{#if errorMessage}
				<div class="mt-4 rounded-md bg-red-50 p-4">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-red-800">{errorMessage}</p>
						</div>
						<div class="ml-auto pl-3">
							<button
								onclick={() => (errorMessage = '')}
								class="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
							>
								<span class="sr-only">Dismiss</span>
								<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/if}

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
			<KanbanBoard optimisticEnhance={optimisticEnhance} />
		{:else if activeTab === 'workPackages'}
			<WorkPackagesTable optimisticEnhance={optimisticEnhance} />
		{:else}
			<TeamManager optimisticEnhance={optimisticEnhance} />
		{/if}
	</main>
</div>
