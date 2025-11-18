import { writable, derived } from 'svelte/store';
import type { WorkPackage, Team, AppState } from '$lib/types';
import * as ops from './operations';

// Create the main state store
export const createAppStore = (initialState?: AppState) => {
	// Initialize with provided state or empty state
	const { subscribe, update, set } = writable<AppState>(
		initialState || { teams: [], workPackages: [] }
	);

	return {
		subscribe,
		set,
		update,

		// Team operations
		addTeam: (name: string, capacity: number) => {
			update((state) => ops.addTeam(state, name, capacity));
		},

		updateTeam: (id: string, updates: Partial<Omit<Team, 'id'>>) => {
			update((state) => ops.updateTeam(state, id, updates));
		},

		deleteTeam: (id: string) => {
			update((state) => ops.deleteTeam(state, id));
		},

		// Team capacity override operations
		setMonthlyCapacity: (teamId: string, yearMonth: string, capacity: number) => {
			update((state) => ops.setMonthlyCapacity(state, teamId, yearMonth, capacity));
		},

		clearMonthlyCapacity: (teamId: string, yearMonth: string) => {
			update((state) => ops.clearMonthlyCapacity(state, teamId, yearMonth));
		},

		// Work package operations
		addWorkPackage: (title: string, size: number, description?: string) => {
			update((state) => ops.addWorkPackage(state, title, size, description));
		},

		updateWorkPackage: (id: string, updates: Partial<Omit<WorkPackage, 'id'>>) => {
			update((state) => ops.updateWorkPackage(state, id, updates));
		},

		deleteWorkPackage: (id: string) => {
			update((state) => ops.deleteWorkPackage(state, id));
		},

		assignWorkPackage: (workPackageId: string, teamId: string | undefined) => {
			update((state) => ops.assignWorkPackage(state, workPackageId, teamId));
		}
	};
};

// Create derived stores from an app state store instance
export const createDerivedStores = (appState: ReturnType<typeof createAppStore>) => {
	const teams = derived(appState, ($state) => $state.teams);

	const workPackages = derived(appState, ($state) =>
		[...$state.workPackages].sort((a, b) => a.priority - b.priority)
	);

	const unassignedWorkPackages = derived(appState, ($state) =>
		$state.workPackages.filter((wp) => !wp.assignedTeamId).sort((a, b) => a.priority - b.priority)
	);

	return { teams, workPackages, unassignedWorkPackages };
};
