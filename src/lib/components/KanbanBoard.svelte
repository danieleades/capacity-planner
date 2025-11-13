<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import { appState, teams } from '$lib/stores/appState';
	import {
		calculateTeamBacklog,
		formatMonths,
		formatDate,
		type TeamBacklogMetrics,
	} from '$lib/utils/capacity';
	import type { WorkPackage, Team } from '$lib/types';
	import Modal from './Modal.svelte';
	import CapacitySparkline from './CapacitySparkline.svelte';
	import WorkPackageForm from './WorkPackageForm.svelte';

	const flipDurationMs = 200;

	// Work package form state
	let showAddModal = $state(false);
	let editingWorkPackage = $state<string | null>(null);
	let formTitle = $state('');
	let formSize = $state(0);
	let formDescription = $state('');

	function openAddModal() {
		formTitle = '';
		formSize = 0;
		formDescription = '';
		editingWorkPackage = null;
		showAddModal = true;
	}

	function closeModal() {
		showAddModal = false;
		editingWorkPackage = null;
		formTitle = '';
		formSize = 0;
		formDescription = '';
	}

	function handleSubmit(title: string, size: number, description?: string) {
		if (editingWorkPackage) {
			appState.updateWorkPackage(editingWorkPackage, {
				title,
				sizeInPersonMonths: size,
				description,
			});
		} else {
			appState.addWorkPackage(title, size, description);
		}

		closeModal();
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
	// Optimized to pre-group work packages once instead of filtering per team
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
			const metrics = calculateTeamBacklog(team, $appState.workPackages);

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

		// Update both team assignment AND scheduledPosition
		// scheduledPosition is the board view ordering (persistent, for planning/phasing)
		// priority remains unchanged (that's the global canonical ordering)
		const scheduledPositionMap = new Map(items.map((wp, index) => [wp.id, index]));

		appState.update((state) => {
			const updatedWorkPackages = state.workPackages.map((wp) => {
				if (scheduledPositionMap.has(wp.id)) {
					return {
						...wp,
						assignedTeamId: newTeamId,
						scheduledPosition: scheduledPositionMap.get(wp.id)!,
					};
				}
				return wp;
			});

			return {
				...state,
				workPackages: updatedWorkPackages,
			};
		});
	}

	function reorderByPriority() {
		// Clear scheduledPosition for all unassigned work packages
		// This makes them fall back to priority ordering
		appState.update((state) => {
			const updatedWorkPackages = state.workPackages.map((wp) => {
				if (!wp.assignedTeamId) {
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { scheduledPosition, ...rest } = wp;
					return rest;
				}
				return wp;
			});

			return {
				...state,
				workPackages: updatedWorkPackages,
			};
		});
	}
</script>

<div class="mb-6">
	<h2 class="mb-4 text-2xl font-bold">Capacity Planning Board</h2>

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
								Backlog: <span class="font-medium"
									>{column.capacity.totalWorkMonths.toFixed(1)} person-months</span
								>
							</p>
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
						<div class="mb-2 cursor-move rounded border border-gray-300 bg-white p-3 shadow-sm">
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
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<Modal
	bind:open={showAddModal}
	title={editingWorkPackage ? 'Edit Work Package' : 'Add Work Package'}
	onClose={closeModal}
>
	<WorkPackageForm
		bind:title={formTitle}
		bind:size={formSize}
		bind:description={formDescription}
		isEditing={!!editingWorkPackage}
		onSubmit={handleSubmit}
		onCancel={closeModal}
	/>
</Modal>
