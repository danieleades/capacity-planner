import { writable, derived } from 'svelte/store';
import type { WorkPackage, Team, AppState } from '$lib/types';
import { browser } from '$app/environment';
import { resolve } from '$app/paths';
import * as ops from './operations';

// Debounce timer for saving to server
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 1000;

// Error store for save failures
export const saveError = writable<string | null>(null);

/**
 * Save state to server with debouncing
 */
async function saveToServer(state: AppState) {
	if (!browser) return;

	try {
		const response = await fetch(resolve('/api/state'), {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(state)
		});

		if (!response.ok) {
			const error = await response.json();
			console.error('Failed to save state:', error);
			saveError.set(error.error || 'Failed to save changes');
		} else {
			// Clear error on successful save
			saveError.set(null);
		}
	} catch (error) {
		console.error('Network error saving state:', error);
		saveError.set('Network error: Unable to save changes');
	}
}

/**
 * Debounced save function
 */
function debouncedSave(state: AppState) {
	if (saveTimeout) {
		clearTimeout(saveTimeout);
	}
	saveTimeout = setTimeout(() => {
		saveToServer(state);
	}, SAVE_DEBOUNCE_MS);
}

// Create the main state store
const createAppStore = (initialState?: AppState) => {
	// Initialize with provided state or empty state
	const { subscribe, update, set } = writable<AppState>(
		initialState || { teams: [], workPackages: [] }
	);

	// Auto-save on every update (debounced), but skip the initial hydration
	let isHydrated = false;
	subscribe((state) => {
		if (!isHydrated) {
			isHydrated = true;
			return; // Skip first emission from hydration
		}
		debouncedSave(state);
	});

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

// Create the app state store (will be initialized from page with server data)
export const appState = createAppStore();

// Derived stores for easier access
export const teams = derived(appState, ($state) => $state.teams);

export const workPackages = derived(appState, ($state) =>
	[...$state.workPackages].sort((a, b) => a.priority - b.priority)
);

export const unassignedWorkPackages = derived(appState, ($state) =>
	$state.workPackages.filter((wp) => !wp.assignedTeamId).sort((a, b) => a.priority - b.priority)
);
