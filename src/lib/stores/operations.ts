import type { Team, WorkPackage, MonthlyCapacity, AppState, ReorderUpdate, TeamId, WorkPackageId } from '$lib/types';
import { generateTeamId, generateWorkPackageId } from '$lib/types';

/**
 * Pure functions for state operations - testable without side effects
 */

// Team Operations

export function addTeam(state: AppState, name: string, capacity: number, id?: TeamId): AppState {
	return {
		...state,
		teams: [
			...state.teams,
			{
				id: id || generateTeamId(),
				name,
				monthlyCapacityInPersonMonths: capacity,
				capacityOverrides: [],
			},
		],
	};
}

export function updateTeam(
	state: AppState,
	id: TeamId,
	updates: Partial<Omit<Team, 'id'>>
): AppState {
	return {
		...state,
		teams: state.teams.map((team) => (team.id === id ? { ...team, ...updates } : team)),
	};
}

export function deleteTeam(state: AppState, id: TeamId): AppState {
	return {
		...state,
		teams: state.teams.filter((team) => team.id !== id),
		// Unassign work packages from deleted team and clear scheduledPosition
		workPackages: state.workPackages.map((wp) =>
			wp.assignedTeamId === id
				? { ...wp, assignedTeamId: null, scheduledPosition: null }
				: wp
		),
	};
}

// Capacity Override Operations

export function setMonthlyCapacity(
	state: AppState,
	teamId: TeamId,
	yearMonth: string,
	capacity: number
): AppState {
	return {
		...state,
		teams: state.teams.map((team) => {
			if (team.id !== teamId) return team;

			const defaultCapacity = team.monthlyCapacityInPersonMonths;

			// If capacity matches default, remove override instead of adding it
			if (capacity === defaultCapacity) {
				const newOverrides = team.capacityOverrides.filter((co) => co.yearMonth !== yearMonth);
				return { ...team, capacityOverrides: newOverrides };
			}

			// Otherwise, add or update override
			const overrides = team.capacityOverrides;
			const existingIndex = overrides.findIndex((co) => co.yearMonth === yearMonth);

			let newOverrides: MonthlyCapacity[];
			if (existingIndex >= 0) {
				// Update existing override
				newOverrides = overrides.map((co, i) =>
					i === existingIndex ? { ...co, capacity } : co
				);
			} else {
				// Add new override
				newOverrides = [...overrides, { yearMonth, capacity }];
			}

			return { ...team, capacityOverrides: newOverrides };
		}),
	};
}

// Work Package Operations

export function addWorkPackage(
	state: AppState,
	title: string,
	size: number,
	description?: string,
	id?: WorkPackageId
): AppState {
	// Priority starts at 0 for first work package, then increments from max existing priority
	// When empty: maxPriority = -1, so first work package gets priority 0
	// When not empty: maxPriority = highest existing priority, new work package gets priority + 1
	const maxPriority = state.workPackages.length === 0
		? -1
		: Math.max(...state.workPackages.map((wp) => wp.priority));

	return {
		...state,
		workPackages: [
			...state.workPackages,
			{
				id: id || generateWorkPackageId(),
				title,
				description: description ?? null,
				sizeInPersonMonths: size,
				priority: maxPriority + 1,
				assignedTeamId: null,
				scheduledPosition: null,
				progressPercent: 0,
			},
		],
	};
}

export function updateWorkPackage(
	state: AppState,
	id: WorkPackageId,
	updates: Partial<Omit<WorkPackage, 'id'>>
): AppState {
	return {
		...state,
		workPackages: state.workPackages.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp)),
	};
}

export function deleteWorkPackage(state: AppState, id: WorkPackageId): AppState {
	return {
		...state,
		workPackages: state.workPackages.filter((wp) => wp.id !== id),
	};
}

/**
 * Batch update work packages - used for drag-and-drop operations
 * Updates assignedTeamId and/or scheduledPosition for multiple work packages atomically
 */
export function batchUpdateWorkPackages(
	state: AppState,
	updates: ReorderUpdate[]
): AppState {
	return {
		...state,
		workPackages: state.workPackages.map((wp) => {
			const update = updates.find((u) => u.id === wp.id);
			if (!update) return wp;

			return {
				...wp,
				assignedTeamId: update.teamId,
				scheduledPosition: update.position,
			};
		}),
	};
}

/**
 * Clear scheduledPosition for all unassigned work packages
 * This makes them fall back to priority-based sorting
 */
export function clearUnassignedScheduledPositions(state: AppState): AppState {
	return {
		...state,
		workPackages: state.workPackages.map((wp) =>
			wp.assignedTeamId === null
				? { ...wp, scheduledPosition: null }
				: wp
		),
	};
}
