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
	description?: string
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

export function reconcileTeamClientId(state: AppState, clientId: string, serverId: string): AppState {
	if (!clientId) return state;

	const teamIndex = state.teams.findIndex(
		(team) => team.clientId === clientId || team.id === clientId
	);
	if (teamIndex === -1) return state;

	const previousId = state.teams[teamIndex].id;
	const teams = state.teams.map((team, index) =>
		index === teamIndex ? { ...team, id: serverId, clientId: undefined } : team
	);

	const workPackages = state.workPackages.map((wp) =>
		wp.assignedTeamId === previousId ? { ...wp, assignedTeamId: serverId } : wp
	);

	return {
		...state,
		teams,
		workPackages,
	};
}

export function removeTeamByClientId(state: AppState, clientId: string): AppState {
	if (!clientId) return state;

	const targetTeam = state.teams.find((team) => team.clientId === clientId);
	if (!targetTeam) return state;

	return {
		...state,
		teams: state.teams.filter((team) => team.clientId !== clientId),
		workPackages: state.workPackages.map((wp) =>
			wp.assignedTeamId === targetTeam.id ? { ...wp, assignedTeamId: undefined } : wp
		),
	};
}

export function reconcileWorkPackageClientId(
	state: AppState,
	clientId: string,
	serverId: string
): AppState {
	if (!clientId) return state;

	const workPackageIndex = state.workPackages.findIndex(
		(wp) => wp.clientId === clientId || wp.id === clientId
	);
	if (workPackageIndex === -1) return state;

	return {
		...state,
		workPackages: state.workPackages.map((wp, index) =>
			index === workPackageIndex ? { ...wp, id: serverId, clientId: undefined } : wp
		),
	};
}

export function removeWorkPackageByClientId(state: AppState, clientId: string): AppState {
	if (!clientId) return state;

	return {
		...state,
		workPackages: state.workPackages.filter(
			(wp) => wp.clientId !== clientId
		),
	};
}
