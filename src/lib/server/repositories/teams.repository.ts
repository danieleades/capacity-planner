import { db as defaultDb } from '../db';
import { teams, capacityOverrides, workPackages } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { Team, CapacityOverride, NewTeam, TeamUpdate, DbParam } from './types';
import { teamValidation, capacityOverrideValidation, handleValidationError } from '../validation';
import { withTimestamps, withUpdatedTimestamp, dbOperation } from './db-helpers';
import { generateId } from '$lib/utils/id';

/**
 * Re-export types for backward compatibility
 */
export type { Team, CapacityOverride };
export type CreateTeamInput = NewTeam;
export type UpdateTeamInput = TeamUpdate;

/**
 * Create a new team with UUID generation and validation
 * @param input - Team creation data
 * @param db - Database instance (defaults to main db)
 * @returns Object containing the generated team ID
 */
export async function createTeam(
	input: CreateTeamInput,
	db: DbParam = defaultDb
): Promise<{ id: string }> {
	return dbOperation(async () => {
		try {
			const validated = teamValidation.create.parse(input);
			const teamData = withTimestamps(validated);

			db.insert(teams).values(teamData).run();

			return { id: teamData.id };
		} catch (error) {
			handleValidationError(error, 'create team');
		}
	}, 'Failed to create team');
}

/**
 * Update an existing team with timestamp updates
 * @param id - Team ID
 * @param input - Team update data
 * @param db - Database instance (defaults to main db)
 */
export async function updateTeam(
	id: string,
	input: UpdateTeamInput,
	db: DbParam = defaultDb
): Promise<void> {
	return dbOperation(async () => {
		try {
			const validated = teamValidation.update.parse(input);

			if (Object.keys(validated).length === 0) {
				return;
			}

			db.update(teams).set(withUpdatedTimestamp(validated)).where(eq(teams.id, id)).run();
		} catch (error) {
			handleValidationError(error, 'update team');
		}
	}, 'Failed to update team');
}

/**
 * Delete a team
 * Cascade deletion will automatically remove related capacity overrides
 * Work packages assigned to this team will have their assignedTeamId and scheduledPosition set to null
 * @param id - Team ID
 * @param db - Database instance (defaults to main db)
 */
export async function deleteTeam(id: string, db: DbParam = defaultDb): Promise<void> {
	return dbOperation(async () => {
		// First, unassign all work packages from this team
		// This ensures both assignedTeamId and scheduledPosition are set to null
		db.update(workPackages)
			.set(
				withUpdatedTimestamp({
					assignedTeamId: null,
					scheduledPosition: null
				})
			)
			.where(eq(workPackages.assignedTeamId, id))
			.run();

		// Then delete the team (cascade will handle capacity overrides)
		db.delete(teams).where(eq(teams.id, id)).run();
	}, 'Failed to delete team');
}

/**
 * Set or update a capacity override for a team in a specific month
 * Uses upsert logic to either insert a new override or update an existing one
 * @param teamId - Team ID
 * @param yearMonth - Year and month in format "YYYY-MM"
 * @param capacity - Override capacity value
 * @param db - Database instance (defaults to main db)
 */
export async function setCapacityOverride(
	teamId: string,
	yearMonth: string,
	capacity: number,
	db: DbParam = defaultDb
): Promise<void> {
	return dbOperation(async () => {
		try {
			const validated = capacityOverrideValidation.create.parse({
				id: generateId(),
				teamId,
				yearMonth,
				capacity
			});

			const existing = db
				.select()
				.from(capacityOverrides)
				.where(
					and(
						eq(capacityOverrides.teamId, validated.teamId),
						eq(capacityOverrides.yearMonth, validated.yearMonth)
					)
				)
				.get();

			if (existing) {
				db.update(capacityOverrides)
					.set(withUpdatedTimestamp({ capacity: validated.capacity }))
					.where(
						and(
							eq(capacityOverrides.teamId, validated.teamId),
							eq(capacityOverrides.yearMonth, validated.yearMonth)
						)
					)
					.run();
			} else {
				const overrideData = withTimestamps(validated);
				db.insert(capacityOverrides).values(overrideData).run();
			}
		} catch (error) {
			handleValidationError(error, 'set capacity override');
		}
	}, 'Failed to set capacity override');
}

/**
 * Remove a capacity override for a team in a specific month
 * @param teamId - Team ID
 * @param yearMonth - Year and month in format "YYYY-MM"
 * @param db - Database instance (defaults to main db)
 */
