<script lang="ts">
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import { optimistikit } from 'optimistikit';
	import { enhance as svelteKitEnhance } from '$app/forms';
	import { SvelteMap, SvelteDate } from 'svelte/reactivity';
	import type { PageData } from './$types';
	import type { ActionResult } from '@sveltejs/kit';
	import TeamManager from '$lib/components/TeamManager.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import WorkPackagesTable from '$lib/components/WorkPackagesTable.svelte';
	import GanttChart from '$lib/components/GanttChart.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import { createAppStore, createDerivedStores } from '$lib/stores/appState';
	import { unsafeTeamId, unsafeWorkPackageId } from '$lib/types';

	// Get page data as props - data stays reactive for optimistikit
	const { data }: { data: PageData } = $props();

	let activeTab = $state<'board' | 'workPackages' | 'teams' | 'gantt'>('board');
	let errorMessage = $state<string>('');
	let lastFailedAction = $state<(() => void) | null>(null);

	/** Format a Date as YYYY-MM-DD for input fields */
	function formatDateForInput(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/** Parse YYYY-MM-DD string to Date, returns null if invalid */
	function parseDateInput(value: string): Date | null {
		const [yearStr, monthStr, dayStr] = value.split('-');
		const year = Number(yearStr);
		const month = Number(monthStr);
		const day = Number(dayStr);
		if (!year || !month || !day) return null;
		const date = new Date(year, month - 1, day);
		if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
			return null;
		}
		return date;
	}

	/**
	 * Convert server data's planningStartDate to a Date object.
	 * SvelteKit serializes Date objects to ISO strings during SSR/hydration,
	 * so we need to parse them back to Date objects on the client.
	 */
	function toDate(value: Date | string): Date {
		if (value instanceof Date) return value;
		// Handle ISO string from SSR serialization
		return new Date(value);
	}

	// Planning start date - the actual Date object used by components
	// Initialize as placeholder; $effect below will set the real value synchronously on mount
	let planningStartDate: Date = $state(new Date());

	// String representation for the input field
	let planningStartDateInput: string = $state('');

	// Debounced save to server when planning start date changes
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastSavedTimestamp: number = $state(0);

	// Sync from server data on mount and when data changes
	// This runs synchronously on mount, so the placeholder values above are never visible
	$effect(() => {
		const serverDate = toDate(data.planningStartDate);
		planningStartDate = serverDate;
		planningStartDateInput = formatDateForInput(serverDate);
		lastSavedTimestamp = serverDate.getTime();
	});

	// Update the Date when input changes
	function handleDateInputChange(value: string) {
		planningStartDateInput = value;
		const parsed = parseDateInput(value);
		if (parsed) {
			planningStartDate = parsed;
		}
	}

	const today = new SvelteDate();
	const planningStartIsPast = $derived.by(() => {
		const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const start = new Date(
			planningStartDate.getFullYear(),
			planningStartDate.getMonth(),
			planningStartDate.getDate()
		);
		return start < todayMidnight;
	});

	$effect(() => {
		const currentTimestamp = planningStartDate.getTime();
		// Skip if unchanged from last saved value
		if (currentTimestamp === lastSavedTimestamp) return;

		// Clear any pending save
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		// Debounce save by 500ms
		saveTimeout = setTimeout(async () => {
			const dateToSave = formatDateForInput(planningStartDate);
			try {
				const formData = new FormData();
				formData.append('date', dateToSave);
				const response = await fetch('?/updatePlanningStartDate', {
					method: 'POST',
					body: formData
				});
				if (response.ok) {
					lastSavedTimestamp = planningStartDate.getTime();
				}
			} catch {
				// Silently fail - user can still work with local value
			}
		}, 500);
	});

	// Snapshot storage for rollback handling
	// Maps form submission ID to snapshot of state before optimistic update
	const rollbackSnapshots = new SvelteMap<string, unknown>();

	// Create per-request store instance and keep it aligned with server data updates
	const appState = createAppStore();
	$effect(() => {
		appState.set(data.initialState);
	});
	const { teams, workPackages, unassignedWorkPackages } = createDerivedStores(appState);

	// Make stores available to child components via context
	setContext('appState', appState);
	setContext('teams', teams);
	setContext('workPackages', workPackages);
	setContext('unassignedWorkPackages', unassignedWorkPackages);
	setContext('rollbackSnapshots', rollbackSnapshots);

	// Wrap page data with optimistikit() to enable optimistic updates
	// We only need the enhance function, not the optimistic data
	type ClientAction =
		| 'create-work-package'
		| 'create-team'
		| 'delete-team'
		| 'delete-work-package'
		| 'update-capacity';
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
		const actionType = formElement.dataset.clientAction as ClientAction | undefined;
		if (!actionType) {
			return;
		}

		// Only rollback on failure or error
		if (result.type !== 'failure' && result.type !== 'error') {
			// Success - clean up any snapshots
			let snapshotKey: string;
			if (actionType === 'update-capacity') {
				const teamId = formData.get('teamId') as string;
				const yearMonth = formData.get('yearMonth') as string;
				snapshotKey = `update-capacity-${teamId}-${yearMonth}`;
			} else {
				snapshotKey = actionType + '-' + getIdFromForm(formData);
			}
			rollbackSnapshots.delete(snapshotKey);
			return;
		}

		// Rollback based on action type
		switch (actionType) {
			case 'create-work-package':
			case 'create-team': {
				const pendingId = getIdFromForm(formData);
				if (pendingId) {
					if (actionType === 'create-work-package') {
						appState.deleteWorkPackage(unsafeWorkPackageId(pendingId));
					} else {
						appState.deleteTeam(unsafeTeamId(pendingId));
					}
				}
				break;
			}

			case 'delete-team':
			case 'delete-work-package':
			case 'update-capacity': {
				let snapshotKey: string;
				if (actionType === 'update-capacity') {
					const teamId = formData.get('teamId') as string;
					const yearMonth = formData.get('yearMonth') as string;
					snapshotKey = `update-capacity-${teamId}-${yearMonth}`;
				} else {
					snapshotKey = actionType + '-' + getIdFromForm(formData);
				}

				const snapshot = rollbackSnapshots.get(snapshotKey);
				if (snapshot) {
					// Restore the full app state from snapshot
					appState.set(snapshot as typeof $appState);
					rollbackSnapshots.delete(snapshotKey);
				}
				break;
			}
		}

		// Show error message
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
					<button
						onclick={() => (activeTab = 'gantt')}
						class="whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'gantt'
							? 'border-blue-500 text-blue-600'
							: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					>
						Timeline
					</button>
				</nav>
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
				<label class="flex items-center gap-2">
					<span class="font-medium text-gray-700">Planning start</span>
					<input
						type="date"
						class="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700"
						value={planningStartDateInput}
						oninput={(e) => handleDateInputChange(e.currentTarget.value)}
					/>
				</label>
				<button
					type="button"
					class="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
					onclick={() => {
						const todayDate = new Date();
						const todayMidnight = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
						planningStartDate = todayMidnight;
						planningStartDateInput = formatDateForInput(todayMidnight);
					}}
				>
					Today
				</button>
				{#if planningStartIsPast}
					<span class="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
						Start date is in the past
					</span>
				{/if}
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-8">
		{#if activeTab === 'board'}
			<KanbanBoard optimisticEnhance={optimisticEnhance} planningStartDate={planningStartDate} />
		{:else if activeTab === 'workPackages'}
			<WorkPackagesTable optimisticEnhance={optimisticEnhance} />
		{:else if activeTab === 'teams'}
			<TeamManager optimisticEnhance={optimisticEnhance} />
		{:else if activeTab === 'gantt'}
			<GanttChart planningStartDate={planningStartDate} />
		{/if}
	</main>
</div>
