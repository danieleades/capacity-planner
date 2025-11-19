<script lang="ts">
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import { optimistikit } from 'optimistikit';
	import { enhance as svelteKitEnhance } from '$app/forms';
	import type { PageData } from './$types';
import type { ActionResult } from '@sveltejs/kit';
	import TeamManager from '$lib/components/TeamManager.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import WorkPackagesTable from '$lib/components/WorkPackagesTable.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import { createAppStore, createDerivedStores } from '$lib/stores/appState';

	// Use $props to get page data instead of $page store
	const { data }: { data: PageData } = $props();

	let activeTab = $state<'board' | 'workPackages' | 'teams'>('board');
	let errorMessage = $state<string>('');
	let lastFailedAction = $state<(() => void) | null>(null);

	// Create per-request store instance
	const appState = createAppStore(data.initialState);
	const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);

	// Make stores available to child components via context
	setContext('appState', appState);
	setContext('teams', teams);
	setContext('workPackages', workPackages);
	setContext('unassignedWorkPackages', unassignedWorkPackages);

	// Wrap page data with optimistikit() to enable optimistic updates
	// We only need the enhance function, not the optimistic data
	type CreateClientAction = 'create-work-package';
	type SubmitHandlerArgs = {
		formData: FormData;
		formElement: HTMLFormElement;
		action: URL;
		result: ActionResult;
		update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
	};
	type GenericSubmitHandler = (opts: SubmitHandlerArgs) => Promise<void> | void;

	const enhanceWithResultHandling: typeof svelteKitEnhance = (form, callback) =>
		svelteKitEnhance(form, (props) => {
			const maybeHandler = callback?.(props) as
				| void
				| GenericSubmitHandler
				| Promise<void | GenericSubmitHandler>;
			if (!maybeHandler) {
				return maybeHandler;
			}

			return async (event) => {
				const handler = (await maybeHandler) as GenericSubmitHandler | void;
				if (!handler) {
					return;
				}

				try {
					await handler(event as SubmitHandlerArgs);
				} finally {
					processActionResult(event);
				}
			};
		});

	function processActionResult({
		formElement,
		formData,
		result
	}: {
		formElement: HTMLFormElement;
		formData: FormData;
		result: ActionResult;
	}) {
		const actionType = formElement.dataset.clientAction as CreateClientAction | undefined;
		if (actionType !== 'create-work-package') {
			return;
		}

		const pendingId = getIdFromForm(formData);
		if (!pendingId) {
			return;
		}

		if (result.type === 'failure' || result.type === 'error') {
			appState.deleteWorkPackage(pendingId);

			if (result.type === 'error') {
				const message =
					result.error instanceof Error
						? result.error.message
						: typeof result.error === 'string'
							? result.error
							: 'Failed to submit form';
				handleFormError(message);
			}
		}
	}

	function getIdFromForm(formData: FormData): string | null {
		const value = formData.get('id');
		return typeof value === 'string' && value.length > 0 ? value : null;
	}

	const { enhance: optimisticEnhance } = optimistikit(
		() => data,
		{
			key: 'planning-data',
			enhance: enhanceWithResultHandling
		}
	);

	// Watch for form action results to handle errors
	$effect(() => {
		if ($page.form && 'error' in $page.form) {
			const error = $page.form.error as string;
			const details = 'details' in $page.form ? ($page.form.details as string) : '';
			errorMessage = details || error;
		}
	});

	// Export error handler for components to use
	export function handleFormError(error: string, retryAction?: () => void) {
		errorMessage = error;
		lastFailedAction = retryAction || null;
	}

	export function clearError() {
		errorMessage = '';
		lastFailedAction = null;
	}

	function handleRetry() {
		if (lastFailedAction) {
			clearError();
			lastFailedAction();
		}
	}

	function handleRefresh() {
		clearError();
		window.location.reload();
	}

	// Make error handler available globally for child components
	if (typeof window !== 'undefined') {
		(window as Window & { handleFormError?: typeof handleFormError }).handleFormError = handleFormError;
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
				<div class="mt-4">
					<ErrorBanner
						message={errorMessage}
						onDismiss={clearError}
						onRetry={lastFailedAction ? handleRetry : handleRefresh}
					/>
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
