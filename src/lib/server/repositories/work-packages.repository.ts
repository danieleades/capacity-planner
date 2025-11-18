import { db as defaultDb } from '../db';
import { workPackages } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { WorkPackage, NewWorkPackage, WorkPackageUpdate, DbParam } from './types';
import { workPackageValidation, handleValidationError } from '../validation';
import { withTimestamps, withUpdatedTimestamp, dbOperation } from './db-helpers';

/**
 * Re-export types for backward compatibility
 */
export type { WorkPackage };
export type CreateWorkPackageInput = NewWorkPackage;
export type UpdateWorkPackageInput = WorkPackageUpdate;

/**
 * Create a new work package with UUID generation and validation
 * @param input - Work package creation data
 * @param db - Database instance (defaults to main db)
 * @returns Object containing the generated work package ID
 */
export async function createWorkPackage(
	input: CreateWorkPackageInput,
	db: DbParam = defaultDb
): Promise<{ id: string }> {
	return dbOperation(async () => {
		try {
			const validated = workPackageValidation.create.parse(input);
			const workPackageData = withTimestamps({
				...validated,
				description: validated.description ?? null,
				assignedTeamId: null,
				scheduledPosition: null
			});

			await db.insert(workPackages).values(workPackageData);

			return { id: workPackageData.id };
		} catch (error) {
			handleValidationError(error, 'create work package');
		}
	}, 'Failed to create work package');
}

/**
 * Update an existing work package with timestamp updates
 * @param id - Work package ID
 * @param input - Work package update data
 * @param db - Database instance (defaults to main db)
 */
export async function updateWorkPackage(
	id: string,
	input: UpdateWorkPackageInput,
	db: DbParam = defaultDb
): Promise<void> {
	return dbOperation(async () => {
		try {
			const validated = workPackageValidation.update.parse(input);

			if (Object.keys(validated).length === 0) {
				return;
			}

			await db.update(workPackages).set(withUpdatedTimestamp(validated)).where(eq(workPackages.id, id));
		} catch (error) {
			handleValidationError(error, 'update work package');
		}
	}, 'Failed to update work package');
}

/**
 * Delete a work package
 * @param id - Work package ID
 * @param db - Database instance (defaults to main db)
 */
export async function deleteWorkPackage(id: string, db: DbParam = defaultDb): Promise<void> {
	return dbOperation(async () => {
		await db.delete(workPackages).where(eq(workPackages.id, id));
	}, 'Failed to delete work package');
}

/**
 * Assign a work package to a team with a specific position in the backlog
 * @param workPackageId - Work package ID
 * @param teamId - Team ID to assign to
 * @param position - Position in the team's backlog
 * @param db - Database instance (defaults to main db)
 */
export async function assignWorkPackage(
	workPackageId: string,
	teamId: string,
	position: number,
	db: DbParam = defaultDb
): Promise<void> {
	return dbOperation(async () => {
		await db
			.update(workPackages)
			.set(
				withUpdatedTimestamp({
					assignedTeamId: teamId,
					scheduledPosition: position
				})
			)
			.where(eq(workPackages.id, workPackageId));
	}, 'Failed to assign work package');
}

/**
 * Unassign a work package from its team
 * @param workPackageId - Work package ID
 * @param db - Database instance (defaults to main db)
 */
export async function unassignWorkPackage(
	workPackageId: string,
	db: DbParam = defaultDb
): Promise<void> {
	return dbOperation(async () => {
		await db
			.update(workPackages)
			.set(
				withUpdatedTimestamp({
					assignedTeamId: null,
					scheduledPosition: null
				})
			)
			.where(eq(workPackages.id, workPackageId));
	}, 'Failed to unassign work package');
}

/**
 * Reorder work packages for a team (for drag-and-drop functionality)
 * Updates the scheduledPosition for all work packages in the provided order
 * @param teamId - Team ID
 * @param workPackageIds - Array of work package IDs in the desired order
 * @param db - Database instance (defaults to main db)
 */
export async function reorderWorkPackages(
	teamId: string,
	workPackageIds: string[],
	db: DbParam = defaultDb
): Promise<void> {
	return dbOperation(async () => {
		// Update each work package with its new position
		// Using Promise.all to update all positions in parallel
		await Promise.all(
			workPackageIds.map((workPackageId, index) =>
				db
					.update(workPackages)
					.set(
						withUpdatedTimestamp({
							scheduledPosition: index
						})
					)
					.where(and(eq(workPackages.id, workPackageId), eq(workPackages.assignedTeamId, teamId)))
			)
		);
	}, 'Failed to reorder work packages');
}
