import { db as defaultDb } from '../db';
import { teams, capacityOverrides, workPackages } from '../schema';
import type { DbParam } from './types';
import { dbOperation } from './db-helpers';

/**
 * Domain model interfaces for planning view
 * These are view-specific transformations of the base entities
 */
export interface CapacityOverride {
	yearMonth: string;
	capacity: number;
}

export interface WorkPackage {
	id: string;
	title: string;
	description: string | null;
	sizeInPersonMonths: number;
	priority: number;
	scheduledPosition: number | null;
}

export interface Team {
	id: string;
	name: string;
	monthlyCapacity: number;
	capacityOverrides: CapacityOverride[];
	workPackages: WorkPackage[];
}

export interface PlanningView {
	teams: Team[];
	unassignedWorkPackages: WorkPackage[];
}

/**
 * Get the complete planning view with teams, capacity overrides, and work packages
 * This function joins all relevant data and transforms it into domain models
 * 
 * @param db - Database instance (defaults to main db)
 * @returns PlanningView containing teams with their work packages and unassigned work packages
 */
export function getPlanningView(db: DbParam = defaultDb): PlanningView {
	return dbOperation(() => {
		// Fetch all teams
		const allTeams = db.select().from(teams).all();

		// Fetch all capacity overrides
		const allCapacityOverrides = db.select().from(capacityOverrides).all();

		// Fetch all work packages
		const allWorkPackages = db.select().from(workPackages).all();

		// Build a map of team ID to capacity overrides
		const capacityOverridesByTeam = new Map<string, CapacityOverride[]>();
		for (const override of allCapacityOverrides) {
			if (!capacityOverridesByTeam.has(override.teamId)) {
				capacityOverridesByTeam.set(override.teamId, []);
			}
			capacityOverridesByTeam.get(override.teamId)!.push({
				yearMonth: override.yearMonth,
				capacity: override.capacity
			});
		}

		// Build a map of team ID to work packages
		const workPackagesByTeam = new Map<string, WorkPackage[]>();
		const unassignedWorkPackages: WorkPackage[] = [];

		for (const wp of allWorkPackages) {
			const workPackage: WorkPackage = {
				id: wp.id,
				title: wp.title,
				description: wp.description,
				sizeInPersonMonths: wp.sizeInPersonMonths,
				priority: wp.priority,
				scheduledPosition: wp.scheduledPosition
			};

			if (wp.assignedTeamId) {
				if (!workPackagesByTeam.has(wp.assignedTeamId)) {
					workPackagesByTeam.set(wp.assignedTeamId, []);
				}
				workPackagesByTeam.get(wp.assignedTeamId)!.push(workPackage);
			} else {
				unassignedWorkPackages.push(workPackage);
			}
		}

		// Sort work packages by scheduled_position within each team
		for (const teamWorkPackages of workPackagesByTeam.values()) {
			teamWorkPackages.sort((a, b) => {
				// Handle null positions - put them at the end
				if (a.scheduledPosition === null && b.scheduledPosition === null) return 0;
				if (a.scheduledPosition === null) return 1;
				if (b.scheduledPosition === null) return -1;
				return a.scheduledPosition - b.scheduledPosition;
			});
		}

		// Sort unassigned work packages by scheduledPosition (if set), otherwise by priority
		unassignedWorkPackages.sort((a, b) => {
			// Both have scheduled positions - use those
			if (a.scheduledPosition !== null && b.scheduledPosition !== null) {
				return a.scheduledPosition - b.scheduledPosition;
			}
			// One has scheduled position - it comes first
			if (a.scheduledPosition !== null) return -1;
			if (b.scheduledPosition !== null) return 1;
			// Neither has scheduled position - fall back to priority
			return a.priority - b.priority;
		});

		// Transform teams into domain models
		const teamModels: Team[] = allTeams.map((team) => ({
			id: team.id,
			name: team.name,
			monthlyCapacity: team.monthlyCapacity,
			capacityOverrides: capacityOverridesByTeam.get(team.id) || [],
			workPackages: workPackagesByTeam.get(team.id) || []
		}));

		return {
			teams: teamModels,
			unassignedWorkPackages
		};
	}, 'Failed to get planning view');
}
