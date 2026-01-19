import { db as defaultDb } from '../db';
import { teams, capacityOverrides, workPackages, settings } from '../schema';
import type { DbParam } from './types';
import { dbOperation } from './db-helpers';
import { eq } from 'drizzle-orm';
import { scheduledPositionComparator } from '$lib/utils/capacity';

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
	progressPercent: number;
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
				scheduledPosition: wp.scheduledPosition,
				progressPercent: wp.progressPercent
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

		// Sort work packages by scheduled position with fallback to priority
		for (const teamWorkPackages of workPackagesByTeam.values()) {
			teamWorkPackages.sort(scheduledPositionComparator);
		}

		// Sort unassigned work packages by scheduledPosition (if set), otherwise by priority
		unassignedWorkPackages.sort(scheduledPositionComparator);

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

const PLANNING_START_DATE_KEY = 'planning_start_date';

/**
 * Get the planning start date from settings
 * Returns the stored date string in YYYY-MM-DD format, or null if not set
 */
export function getPlanningStartDate(db: DbParam = defaultDb): string | null {
	return dbOperation(() => {
		const result = db
			.select({ value: settings.value })
			.from(settings)
			.where(eq(settings.key, PLANNING_START_DATE_KEY))
			.get();
		return result?.value ?? null;
	}, 'Failed to get planning start date');
}

/**
 * Set the planning start date in settings
 * @param dateStr - Date string in YYYY-MM-DD format
 */
export function setPlanningStartDate(dateStr: string, db: DbParam = defaultDb): void {
	dbOperation(() => {
		const now = new Date();
		db.insert(settings)
			.values({
				key: PLANNING_START_DATE_KEY,
				value: dateStr,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: settings.key,
				set: {
					value: dateStr,
					updatedAt: now
				}
			})
			.run();
	}, 'Failed to set planning start date');
}
