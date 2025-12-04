<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { dndzone } from 'svelte-dnd-action';
	import { createAppStore } from '$lib/stores/appState';
	import {
		calculateTeamBacklog,
		formatMonths,
		formatDate,
		getRemainingWork,
		calculateCardHeight,
		type TeamBacklogMetrics,
	} from '$lib/utils/capacity';
	import type { WorkPackage, Team, PlanningPageData } from '$lib/types';
	import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
	import CapacitySparkline from './CapacitySparkline.svelte';
	import WorkPackageModal from './WorkPackageModal.svelte';

	interface Props {
		optimisticEnhance: OptimisticEnhanceAction<PlanningPageData>;
	}

	let { optimisticEnhance }: Props = $props();

	// Get stores from context
	const appState = getContext<ReturnType<typeof createAppStore>>('appState');
	const teams = getContext<Readable<Team[]>>('teams');

	const flipDurationMs = 200;

	// Modal state
	let showAddModal = $state(false);
	let editingWorkPackage = $state<WorkPackage | undefined>(undefined);

	// View settings (persisted to localStorage)
	const SIZE_SCALING_KEY = 'kanban-size-scaling-intensity';
	let sizeScalingIntensity = $state(
		typeof localStorage !== 'undefined'
			? parseInt(localStorage.getItem(SIZE_SCALING_KEY) ?? '0', 10)
			: 0
	);

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(SIZE_SCALING_KEY, String(sizeScalingIntensity));
		}
	});

	function openAddModal() {
		editingWorkPackage = undefined;
		showAddModal = true;
	}

	function closeModal() {
		showAddModal = false;
		editingWorkPackage = undefined;
	}

	interface Column {
		id: string;
		title: string;
		items: WorkPackage[];
		team?: Team; // Team object for sparkline display
		capacity:
			| (TeamBacklogMetrics & {
					monthlyCapacity: number;
			  })
			| null;
	}

	// Helper function to build columns from store data
	// Sort by scheduledPosition (for board planning) with fallback to priority
	// 
	// Performance optimization: Pre-groups work packages by team in O(n) time,
	// then passes pre-filtered arrays to calculateTeamBacklog to avoid redundant
	// O(n) filtering per team. This reduces complexity from O(teams × packages) to O(packages).
	function buildColumns(): Column[] {
		const sortByScheduledPosition = (items: WorkPackage[]) =>
			items.sort((a, b) => {
				const posA = a.scheduledPosition ?? a.priority;
				const posB = b.scheduledPosition ?? b.priority;
				return posA - posB;
			});

		// Pre-group work packages by team (O(n) instead of O(teams × packages))
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const workPackagesByTeam = new Map<string | undefined, WorkPackage[]>();
		for (const wp of $appState.workPackages) {
			const teamId = wp.assignedTeamId;
			if (!workPackagesByTeam.has(teamId)) {
				workPackagesByTeam.set(teamId, []);
			}
			workPackagesByTeam.get(teamId)!.push(wp);
		}

		const cols: Column[] = [
			{
				id: 'unassigned',
				title: 'Unassigned',
				items: sortByScheduledPosition([...(workPackagesByTeam.get(undefined) || [])]),
				capacity: null,
			},
		];

		for (const team of $teams) {
			const teamWPs = workPackagesByTeam.get(team.id) || [];
			// Pass preFiltered=true since teamWPs is already filtered for this team
			// This avoids redundant O(n) filtering inside calculateTeamBacklog
			const metrics = calculateTeamBacklog(team, teamWPs, true);

			cols.push({
				id: team.id,
				title: team.name,
				team, // Include team object for sparkline
				items: sortByScheduledPosition([...teamWPs]),
				capacity: {
					monthlyCapacity: team.monthlyCapacityInPersonMonths,
					...metrics,
				},
			});
		}

		return cols;
	}

	// Use mutable local state for columns (required by svelte-dnd-action)
	// eslint-disable-next-line svelte/prefer-writable-derived
	let columns: Column[] = $state(buildColumns());

	// Sync columns when store changes (add/edit/delete operations)
	// buildColumns() will sort by scheduledPosition (with fallback to priority)
	// Note: $state + $effect is required here instead of $derived because
	// svelte-dnd-action needs mutable local state that gets updated in event handlers
	$effect(() => {
		columns = buildColumns();
	});

	// Calculate global maximum remaining work across all work packages for size scaling
	const globalMaxRemainingWork = $derived(
		$appState.workPackages.reduce((max, wp) => Math.max(max, getRemainingWork(wp)), 0)
	);

	function handleDndConsider(columnId: string, e: CustomEvent) {
		// Update local state during drag for visual feedback
		const items = e.detail.items as WorkPackage[];

		columns = columns.map((col) => {
			if (col.id === columnId) {
				return { ...col, items };
			}
			return col;
		});
	}

	/**
	 * Handle drag-and-drop finalize event
	 * 
	 * Note: svelte-dnd-action fires finalize on BOTH the origin and target zones when an item
	 * is dragged. When the last item is dragged out of a column, the origin zone receives a
	 * finalize event with an empty items array. We must skip the server request in this case
	 * because the server validation explicitly rejects empty update arrays (returns 400 error).
	 * The target zone will handle the actual persistence with the correct data.
	 */
	function handleDndFinalize(columnId: string, e: CustomEvent) {
		const items = e.detail.items as WorkPackage[];
		const newTeamId = columnId === 'unassigned' ? undefined : columnId;


		// Update local state first
		columns = columns.map((col) => {
			if (col.id === columnId) {
				return { ...col, items };
			}
			return col;
		});

		// Collect all updates for the batch request
		type LocalReorderUpdate = {
			id: string;
			teamId: string | null;
			position: number;
		};
		const updates: LocalReorderUpdate[] = items.map((wp, index) => ({
			id: wp.id,
			teamId: newTeamId ?? null,
			position: index,
			isPending: false
		}));
		const persistedUpdates = updates.map((update, index) => ({
			id: update.id,
			teamId: update.teamId,
			position: index
		}));

		// Capture snapshot before optimistic update for rollback
		const snapshot = $appState;

		// Optimistically update the store using batch operation
		appState.batchUpdateWorkPackages(updates.map(u => ({
			id: u.id,
			assignedTeamId: u.teamId,
			scheduledPosition: u.position
		})));

		// Skip server request if there are no persisted updates to send
		if (persistedUpdates.length === 0) {
			return;
		}

		// Submit single batch request to persist all changes
		submitBatchReorder(persistedUpdates, snapshot);
	}

	// Helper function to submit batch reorder to server
	async function submitBatchReorder(
		updates: Array<{ id: string; teamId: string | null; position: number }>,
		snapshot: typeof $appState
	) {
		const formData = new FormData();
		formData.append('updates', JSON.stringify(updates));

		try {
			const response = await fetch('?/reorderWorkPackages', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			// Check HTTP status code first, then result type
			if (!response.ok || result.type === 'failure') {
				const errorMsg = result.data?.details || result.data?.error || 'Failed to reorder work packages';
				console.error('Failed to reorder work packages:', errorMsg);

				// Rollback to snapshot
				appState.set(snapshot);

				// Show error message to user with retry functionality
				const windowWithHandler = window as Window & { handleFormError?: (msg: string, retry?: () => void) => void };
				if (typeof window !== 'undefined' && windowWithHandler.handleFormError) {
					windowWithHandler.handleFormError(errorMsg, () => {
						submitBatchReorder(updates, snapshot);
					});
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Failed to reorder work packages';
			console.error('Failed to reorder work packages:', errorMsg);

			// Rollback to snapshot
			appState.set(snapshot);

			// Show error message to user with retry functionality
			const windowWithHandler = window as Window & { handleFormError?: (msg: string, retry?: () => void) => void };
			if (typeof window !== 'undefined' && windowWithHandler.handleFormError) {
				windowWithHandler.handleFormError(errorMsg, () => {
					submitBatchReorder(updates, snapshot);
				});
			}
		}
	}

	async function reorderByPriority() {
		// Capture snapshot before optimistic update for rollback
		const snapshot = $appState;

		// Optimistically clear scheduledPosition for unassigned work packages
		appState.clearUnassignedScheduledPositions();

		// Persist to server using dedicated action
		try {
			const response = await fetch('?/clearUnassignedPositions', {
				method: 'POST',
				body: new FormData()
			});

			const result = await response.json();

			// Check HTTP status code first, then result type
			if (!response.ok || result.type === 'failure') {
				const errorMsg = result.data?.details || result.data?.error || 'Failed to reset to priority order';
				console.error('Failed to reset to priority order:', errorMsg);

				// Rollback to snapshot
				appState.set(snapshot);

				// Show error message to user with retry functionality
				const windowWithHandler = window as Window & { handleFormError?: (msg: string, retry?: () => void) => void };
				if (typeof window !== 'undefined' && windowWithHandler.handleFormError) {
					windowWithHandler.handleFormError(errorMsg, reorderByPriority);
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Failed to reset to priority order';
			console.error('Failed to reset to priority order:', errorMsg);

			// Rollback to snapshot
			appState.set(snapshot);

			// Show error message to user with retry functionality
			const windowWithHandler = window as Window & { handleFormError?: (msg: string, retry?: () => void) => void };
			if (typeof window !== 'undefined' && windowWithHandler.handleFormError) {
				windowWithHandler.handleFormError(errorMsg, reorderByPriority);
			}
		}
	}
</script>

<div class="mb-6">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-bold">Capacity Planning Board</h2>
		<div class="flex items-center gap-3">
			<label for="size-scaling" class="text-sm text-gray-600">Size scaling</label>
			<input
				id="size-scaling"
				type="range"
				min="0"
				max="100"
				step="10"
				bind:value={sizeScalingIntensity}
				class="h-2 w-24 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
				title="Scale card height by remaining work (0% = off, 100% = maximum)"
			/>
			<span class="w-8 text-sm text-gray-500">{sizeScalingIntensity}%</span>
		</div>
	</div>

	<div class="flex gap-4 overflow-x-auto pb-4">
		{#each columns as column (column.id)}
			<div class="min-w-80 shrink-0 rounded-lg border border-gray-200 bg-gray-50">
				<div class="border-b border-gray-200 bg-white p-4">
					<div class="mb-1 flex items-center justify-between">
						<h3 class="text-lg font-semibold">{column.title}</h3>
						{#if column.id === 'unassigned'}
							<div class="flex gap-2">
								<button
									onclick={reorderByPriority}
									class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
									title="Reset to global priority order"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
										/>
									</svg>
								</button>
								<button
									onclick={openAddModal}
									class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
								>
									+ Add
								</button>
							</div>
						{/if}
					</div>

					{#if column.capacity}
						<div class="mt-2 space-y-1 text-sm">
							<div class="flex items-center justify-between">
								<span class="text-gray-600">
									Capacity: <span class="font-medium"
										>{column.capacity.monthlyCapacity} PM/mo</span
									>
								</span>
								{#if column.team}
									<CapacitySparkline team={column.team} />
								{/if}
							</div>
							<p class="text-gray-600">
								Backlog:
								<span class="font-medium"
									>{column.capacity.remainingWorkMonths.toFixed(1)} PM</span
								>
								{#if column.capacity.totalWorkMonths !== column.capacity.remainingWorkMonths}
									<span class="text-gray-400">
										/ {column.capacity.totalWorkMonths.toFixed(1)} total
									</span>
								{/if}
							</p>
							{#if column.capacity.remainingWorkMonths === 0 && column.capacity.totalWorkMonths > 0}
								<p class="text-green-600">
									<span class="font-medium">All work complete!</span>
								</p>
							{:else}
								<p class="text-gray-600">
									Time to complete: <span class="font-medium"
										>{formatMonths(column.capacity.monthsToComplete)}</span
									>
								</p>
								<p class="text-gray-600">
									Est. completion: <span class="font-medium"
										>{formatDate(column.capacity.estimatedCompletionDate)}</span
									>
								</p>
							{/if}
						</div>
					{:else}
						<p class="text-sm text-gray-500">Drag work packages here to assign to teams</p>
					{/if}
				</div>

				<div
					class="min-h-96 p-3"
					use:dndzone={{
						items: column.items,
						flipDurationMs,
						dropTargetStyle: {},
					}}
					onconsider={(e) => handleDndConsider(column.id, e)}
					onfinalize={(e) => handleDndFinalize(column.id, e)}
				>
					{#each column.items as wp (wp.id)}
						{@const cardHeight = sizeScalingIntensity > 0
							? calculateCardHeight(getRemainingWork(wp), globalMaxRemainingWork, sizeScalingIntensity)
							: null}
						<div
							class="mb-2 cursor-move rounded border border-gray-300 bg-white p-3 shadow-sm transition-all duration-200"
							style={cardHeight ? `min-height: ${cardHeight}px` : ''}
						>
							<h4 class="mb-1 font-medium">{wp.title}</h4>
							{#if wp.description}
								<p class="mb-2 text-xs text-gray-600">{wp.description}</p>
							{/if}
							<div class="flex items-center justify-between text-xs text-gray-500">
								<span class="rounded bg-blue-100 px-2 py-1 font-medium text-blue-800">
									{wp.sizeInPersonMonths} PM
								</span>
								<span class="text-gray-400">Priority: {wp.priority + 1}</span>
							</div>
							{#if (wp.progressPercent ?? 0) > 0}
								<div class="mt-2">
									<div class="flex items-center justify-between text-xs text-gray-500">
										<span>{wp.progressPercent}% complete</span>
										<span class="text-gray-400">
											{(wp.sizeInPersonMonths * (1 - (wp.progressPercent ?? 0) / 100)).toFixed(1)} PM left
										</span>
									</div>
									<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
										<div
											class="h-1.5 rounded-full bg-green-500"
											style="width: {wp.progressPercent}%"
										></div>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<WorkPackageModal
	{optimisticEnhance}
	bind:open={showAddModal}
	editingWorkPackage={editingWorkPackage}
	onClose={closeModal}
/>
