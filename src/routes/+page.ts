import { appState } from '$lib/stores/appState';
import type { PageLoad } from './$types';
import type { AppState, Team, WorkPackage } from '$lib/types';

export const load: PageLoad = async ({ data }) => {
	// Transform PlanningView to AppState format
	const teams: Team[] = data.planningView.teams.map((team) => ({
		id: team.id,
		name: team.name,
		monthlyCapacityInPersonMonths: team.monthlyCapacity,
		capacityOverrides: team.capacityOverrides.map((override) => ({
			yearMonth: override.yearMonth,
			capacity: override.capacity
		}))
	}));

	// Flatten all work packages from teams and unassigned
	const workPackages: WorkPackage[] = [
		...data.planningView.teams.flatMap((team) =>
			team.workPackages.map((wp) => ({
				id: wp.id,
				title: wp.title,
				description: wp.description ?? undefined,
				sizeInPersonMonths: wp.sizeInPersonMonths,
				priority: wp.priority,
				assignedTeamId: team.id,
				scheduledPosition: wp.scheduledPosition ?? undefined
			}))
		),
		...data.planningView.unassignedWorkPackages.map((wp) => ({
			id: wp.id,
			title: wp.title,
			description: wp.description ?? undefined,
			sizeInPersonMonths: wp.sizeInPersonMonths,
			priority: wp.priority,
			assignedTeamId: undefined,
			scheduledPosition: undefined
		}))
	];

	const appStateData: AppState = {
		teams,
		workPackages
	};

	// Initialize store with server data during load (runs on both server and client)
	appState.set(appStateData);

	return {
		initialState: appStateData
	};
};
