<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { SvelteMap } from 'svelte/reactivity';
	import { dndzone } from 'svelte-dnd-action';
	import { createAppStore } from '$lib/stores/appState';
	import {
		calculateTeamBacklog,
		calculateTeamSchedule,
		formatMonths,
		formatDate,
		getRemainingWork,
		calculateCardHeight,
		sortByScheduledPosition,
		groupWorkPackagesByTeam,
		type TeamBacklogMetrics,
		type ScheduledWorkPackage,
	} from '$lib/utils/capacity';
	import { YearMonth, type WorkPackage, type Team, type PlanningPageData, type ReorderUpdate, type TeamId, unsafeTeamId } from '$lib/types';
	import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
	import CapacitySparkline from './CapacitySparkline.svelte';
	import WorkPackageModal from './WorkPackageModal.svelte';

	interface Props {
		optimisticEnhance: OptimisticEnhanceAction<PlanningPageData>;
		planningStartDate: Date;
	}

	let { optimisticEnhance, planningStartDate }: Props = $props();

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
	// Performance optimization: Pre-groups work packages by team in O(n) time,
	// then passes pre-filtered arrays to calculateTeamBacklog to avoid redundant
	// O(n) filtering per team. This reduces complexity from O(teams × packages) to O(packages).
	function buildColumns(startDate: Date): Column[] {
		const { byTeam, unassigned } = groupWorkPackagesByTeam($appState.workPackages);

		const cols: Column[] = [
			{
				id: 'unassigned',
				title: 'Unassigned',
				items: sortByScheduledPosition(unassigned),
				capacity: null,
			},
		];

		for (const team of $teams) {
			const teamWPs = byTeam.get(team.id) || [];
			// Pass preFiltered=true since teamWPs is already filtered for this team
			// This avoids redundant O(n) filtering inside calculateTeamBacklog
			const metrics = calculateTeamBacklog(team, teamWPs, true, startDate);

			cols.push({
				id: team.id,
				title: team.name,
				team, // Include team object for sparkline
				items: sortByScheduledPosition(teamWPs),
				capacity: {
					monthlyCapacity: team.monthlyCapacityInPersonMonths,
					...metrics,
				},
			});
		}

		return cols;
	}

	// svelte-dnd-action requires mutable local state that DnD handlers can write to.
	// Using $state + $effect.pre (not $derived) because svelte-dnd-action's action
	// update cycle can conflict with writable $derived re-derivation timing.
	// eslint-disable-next-line svelte/prefer-writable-derived -- see comment above
	let columns: Column[] = $state<Column[]>([]);
	// Sync columns when store or planningStartDate changes (runs before DOM update)
	$effect.pre(() => {
		columns = buildColumns(planningStartDate);
	});

	// Calculate global maximum remaining work across all work packages for size scaling
	const globalMaxRemainingWork = $derived(
		$appState.workPackages.reduce((max, wp) => Math.max(max, getRemainingWork(wp)), 0)
	);

	// Create a lookup map from work package ID to its scheduled dates
	// This allows O(1) lookup when rendering cards
	const scheduleLookup = $derived.by(() => {
		const lookup = new SvelteMap<string, ScheduledWorkPackage>();
		for (const team of $teams) {
			const teamWPs = $appState.workPackages.filter((wp) => wp.assignedTeamId === team.id);
			const schedule = calculateTeamSchedule(team, teamWPs, planningStartDate);
			for (const swp of schedule) {
				lookup.set(swp.workPackage.id, swp);
			}
		}
		return lookup;
	});

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
		const newTeamId: TeamId | null = columnId === 'unassigned' ? null : unsafeTeamId(columnId);


		// Update local state first
		columns = columns.map((col) => {
			if (col.id === columnId) {
				return { ...col, items };
			}
			return col;
		});

		// Collect all updates for the batch request using shared DTO type
		const updates: ReorderUpdate[] = items.map((wp, index) => ({
			id: wp.id,
			teamId: newTeamId,
			position: index
		}));

		// Capture snapshot before optimistic update for rollback
		const snapshot = $appState;

		// Optimistically update the store using batch operation
		appState.batchUpdateWorkPackages(updates);

		// Skip server request if there are no updates to send
		if (updates.length === 0) {
			return;
		}

		// Submit single batch request to persist all changes
		submitBatchReorder(updates, snapshot);
	}

	// Centralized error handler for fetch operations with rollback support
	function handleFetchError(
		error: unknown,
		defaultMessage: string,
		snapshot: typeof $appState,
		retry?: () => void
	) {
		const errorMsg =
			error instanceof Error
				? error.message
				: typeof error === 'object' && error !== null && 'data' in error
					? ((error as { data?: { details?: string; error?: string } }).data?.details ||
						(error as { data?: { details?: string; error?: string } }).data?.error ||
						defaultMessage)
					: defaultMessage;

		console.error(defaultMessage, errorMsg);
		appState.set(snapshot);

		const windowWithHandler = window as Window & {
			handleFormError?: (msg: string, retry?: () => void) => void;
		};
		if (typeof window !== 'undefined' && windowWithHandler.handleFormError) {
			windowWithHandler.handleFormError(errorMsg, retry);
		}
	}

	// Helper function to submit batch reorder to server
	async function submitBatchReorder(
		updates: ReorderUpdate[],
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

			if (!response.ok || result.type === 'failure') {
				handleFetchError(result, 'Failed to reorder work packages', snapshot, () =>
					submitBatchReorder(updates, snapshot)
				);
			}
		} catch (error) {
			handleFetchError(error, 'Failed to reorder work packages', snapshot, () =>
				submitBatchReorder(updates, snapshot)
			);
		}
	}

	async function reorderByPriority() {
		const snapshot = $appState;
		appState.clearUnassignedScheduledPositions();

		try {
			const response = await fetch('?/clearUnassignedPositions', {
				method: 'POST',
				body: new FormData()
			});

			const result = await response.json();

			if (!response.ok || result.type === 'failure') {
				handleFetchError(result, 'Failed to reset to priority order', snapshot, reorderByPriority);
			}
		} catch (error) {
			handleFetchError(error, 'Failed to reset to priority order', snapshot, reorderByPriority);
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
						{@const swp = scheduleLookup.get(wp.id)}
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
							{#if swp}
								{@const startYM = YearMonth.fromDate(swp.startDate)}
								{@const endYM = YearMonth.fromDate(swp.endDate)}
								<div class="mt-2 text-xs text-gray-500">
									{#if startYM.toString() === endYM.toString()}
										{startYM.format()}
									{:else}
										{startYM.format()} → {endYM.format()}
									{/if}
								</div>
							{/if}
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
