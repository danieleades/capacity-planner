import { db as defaultDb } from '../db';
import { teams, capacityOverrides } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { Team, CapacityOverride, NewTeam, TeamUpdate, DbParam } from './types';
import { teamValidation, capacityOverrideValidation, handleValidationError } from '../validation';
import { withTimestamps, withUpdatedTimestamp, dbOperation } from './db-helpers';

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

			await db.insert(teams).values(teamData);

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

			await db.update(teams).set(withUpdatedTimestamp(validated)).where(eq(teams.id, id));
		} catch (error) {
			handleValidationError(error, 'update team');
		}
	}, 'Failed to update team');
}

/**
 * Delete a team
 * Cascade deletion will automatically remove related capacity overrides
 * Work packages assigned to this team will have their assignedTeamId set to null
 * @param id - Team ID
 * @param db - Database instance (defaults to main db)
 */
export async function deleteTeam(id: string, db: DbParam = defaultDb): Promise<void> {
	return dbOperation(async () => {
		await db.delete(teams).where(eq(teams.id, id));
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
			const validated = capacityOverrideValidation.create.parse({ teamId, yearMonth, capacity });

			const existing = await db
				.select()
				.from(capacityOverrides)
				.where(
					and(
						eq(capacityOverrides.teamId, validated.teamId),
						eq(capacityOverrides.yearMonth, validated.yearMonth)
					)
				)
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(capacityOverrides)
					.set(withUpdatedTimestamp({ capacity: validated.capacity }))
					.where(
						and(
							eq(capacityOverrides.teamId, validated.teamId),
							eq(capacityOverrides.yearMonth, validated.yearMonth)
						)
					);
			} else {
				const overrideData = withTimestamps(validated);
				await db.insert(capacityOverrides).values(overrideData);
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
export async function removeCapacityOverride(
	teamId: string,
	yearMonth: string,
	db: DbParam = defaultDb
): Promise<void> {
	return dbOperation(async () => {
		await db
			.delete(capacityOverrides)
			.where(
				and(eq(capacityOverrides.teamId, teamId), eq(capacityOverrides.yearMonth, yearMonth))
			);
	}, 'Failed to remove capacity override');
}
