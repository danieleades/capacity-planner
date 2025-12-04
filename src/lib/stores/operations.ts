import type { Team, WorkPackage, MonthlyCapacity, AppState } from '$lib/types';

/**
 * Pure functions for state operations - testable without side effects
 */

// Team Operations

export function addTeam(state: AppState, name: string, capacity: number, id?: string): AppState {
	return {
		...state,
		teams: [
			...state.teams,
			{
				id: id || crypto.randomUUID(),
				name,
				monthlyCapacityInPersonMonths: capacity,
				capacityOverrides: [],
			},
		],
	};
}

export function updateTeam(
	state: AppState,
	id: string,
	updates: Partial<Omit<Team, 'id'>>
): AppState {
	return {
		...state,
		teams: state.teams.map((team) => (team.id === id ? { ...team, ...updates } : team)),
	};
}

export function deleteTeam(state: AppState, id: string): AppState {
	return {
		...state,
		teams: state.teams.filter((team) => team.id !== id),
		// Unassign work packages from deleted team and clear scheduledPosition
		workPackages: state.workPackages.map((wp) =>
			wp.assignedTeamId === id
				? { ...wp, assignedTeamId: undefined, scheduledPosition: undefined }
				: wp
		),
	};
}

// Capacity Override Operations

export function setMonthlyCapacity(
	state: AppState,
	teamId: string,
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

export function clearMonthlyCapacity(
	state: AppState,
	teamId: string,
	yearMonth: string
): AppState {
	return {
		...state,
		teams: state.teams.map((team) => {
			if (team.id !== teamId) return team;

			const overrides = team.capacityOverrides;
			const newOverrides = overrides.filter((co) => co.yearMonth !== yearMonth);

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
	id?: string
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
				id: id || crypto.randomUUID(),
				title,
				description,
				sizeInPersonMonths: size,
				priority: maxPriority + 1,
				assignedTeamId: undefined,
				scheduledPosition: undefined,
				progressPercent: 0,
			},
		],
	};
}

export function updateWorkPackage(
	state: AppState,
	id: string,
	updates: Partial<Omit<WorkPackage, 'id'>>
): AppState {
	return {
		...state,
		workPackages: state.workPackages.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp)),
	};
}

export function deleteWorkPackage(state: AppState, id: string): AppState {
	return {
		...state,
		workPackages: state.workPackages.filter((wp) => wp.id !== id),
	};
}

export function assignWorkPackage(
	state: AppState,
	workPackageId: string,
	teamId: string | undefined
): AppState {
	return {
		...state,
		workPackages: state.workPackages.map((wp) =>
			wp.id === workPackageId ? { ...wp, assignedTeamId: teamId } : wp
		),
	};
}

export function reorderWorkPackages(state: AppState, workPackages: WorkPackage[]): AppState {
	return {
		...state,
		workPackages: workPackages.map((wp, index) => ({ ...wp, priority: index })),
	};
}

/**
 * Batch update work packages - used for drag-and-drop operations
 * Updates assignedTeamId and/or scheduledPosition for multiple work packages atomically
 */
export function batchUpdateWorkPackages(
	state: AppState,
	updates: Array<{ id: string; assignedTeamId?: string | null; scheduledPosition?: number }>
): AppState {
	return {
		...state,
		workPackages: state.workPackages.map((wp) => {
			const update = updates.find((u) => u.id === wp.id);
			if (!update) return wp;

			return {
				...wp,
				...(update.assignedTeamId !== undefined
					? { assignedTeamId: update.assignedTeamId ?? undefined }
					: {}),
				...(update.scheduledPosition !== undefined ? { scheduledPosition: update.scheduledPosition } : {}),
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
		workPackages: state.workPackages.map((wp) => {
			if (!wp.assignedTeamId) {
				// Remove scheduledPosition from unassigned work packages
				const { scheduledPosition: _scheduledPosition, ...rest } = wp;
				return rest;
			}
			return wp;
		}),
	};
}
