import { writable, derived, get } from 'svelte/store';
import type { WorkPackage, Team, AppState, ReorderUpdate, TeamId, WorkPackageId } from '$lib/types';
import * as ops from './operations';

// Create the main state store
export const createAppStore = (initialState?: AppState) => {
	// Initialize with provided state or empty state
	const store = writable<AppState>(
		initialState || { teams: [], workPackages: [] }
	);
	const { subscribe, update, set } = store;

	return {
		subscribe,
		set,
		update,

		// Helper methods
		findWorkPackageById: (id: WorkPackageId): WorkPackage | undefined => {
			const state = get(store);
			return state.workPackages.find((wp) => wp.id === id);
		},

		// Team operations
		addTeam: (name: string, capacity: number, id?: TeamId) => {
			update((state) => ops.addTeam(state, name, capacity, id));
		},

		updateTeam: (id: TeamId, updates: Partial<Omit<Team, 'id'>>) => {
			update((state) => ops.updateTeam(state, id, updates));
		},

		deleteTeam: (id: TeamId) => {
			update((state) => ops.deleteTeam(state, id));
		},

		// Team capacity override operations
		setMonthlyCapacity: (teamId: TeamId, yearMonth: string, capacity: number) => {
			update((state) => ops.setMonthlyCapacity(state, teamId, yearMonth, capacity));
		},

		// Work package operations
		addWorkPackage: (title: string, size: number, description?: string, id?: WorkPackageId) => {
			update((state) => ops.addWorkPackage(state, title, size, description, id));
		},

		updateWorkPackage: (id: WorkPackageId, updates: Partial<Omit<WorkPackage, 'id'>>) => {
			update((state) => ops.updateWorkPackage(state, id, updates));
		},

		deleteWorkPackage: (id: WorkPackageId) => {
			update((state) => ops.deleteWorkPackage(state, id));
		},

		batchUpdateWorkPackages: (updates: ReorderUpdate[]) => {
			update((state) => ops.batchUpdateWorkPackages(state, updates));
		},

		clearUnassignedScheduledPositions: () => {
			update((state) => ops.clearUnassignedScheduledPositions(state));
		},
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
