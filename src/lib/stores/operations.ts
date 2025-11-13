import type { Team, WorkPackage, MonthlyCapacity, AppState } from '$lib/types';

/**
 * Pure functions for state operations - testable without side effects
 */

// Team Operations

export function addTeam(state: AppState, name: string, capacity: number): AppState {
	return {
		...state,
		teams: [
			...state.teams,
			{
				id: crypto.randomUUID(),
				name,
				monthlyCapacityInPersonMonths: capacity,
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
		// Unassign work packages from deleted team
		workPackages: state.workPackages.map((wp) =>
			wp.assignedTeamId === id ? { ...wp, assignedTeamId: undefined } : wp
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

			const overrides = team.capacityOverrides || [];
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

			const overrides = team.capacityOverrides || [];
			const newOverrides = overrides.filter((co) => co.yearMonth !== yearMonth);

			return { ...team, capacityOverrides: newOverrides.length > 0 ? newOverrides : undefined };
		}),
	};
}

// Work Package Operations

export function addWorkPackage(
	state: AppState,
	title: string,
	size: number,
	description?: string
): AppState {
	// Start priority at 0 for the first work package
	const maxPriority = Math.max(-1, ...state.workPackages.map((wp) => wp.priority));
	return {
		...state,
		workPackages: [
			...state.workPackages,
			{
				id: crypto.randomUUID(),
				title,
				description,
				sizeInPersonMonths: size,
				priority: maxPriority + 1,
				assignedTeamId: undefined,
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
