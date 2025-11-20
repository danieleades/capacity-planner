import { db as defaultDb } from '../db';
import { workPackages } from '../schema';
import { eq, sql, isNull } from 'drizzle-orm';
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
 * Priority is computed server-side using MAX(priority) + 1 to ensure uniqueness
 * @param input - Work package creation data (priority is computed, not provided)
 * @param db - Database instance (defaults to main db)
 * @returns Object containing the generated work package ID
 */
export async function createWorkPackage(
	input: CreateWorkPackageInput,
	db: DbParam = defaultDb
): Promise<{ id: string }> {
	return dbOperation(() => {
		// Use a transaction to ensure atomic priority assignment
		// This prevents race conditions where two concurrent creates get the same priority
		const result = db.transaction((tx) => {
			// Compute next priority within transaction using tx handle
			const maxPriorityResult = tx
				.select({ maxPriority: sql<number>`COALESCE(MAX(priority), -1)` })
				.from(workPackages)
				.get();
			
			const priority = (maxPriorityResult?.maxPriority ?? -1) + 1;
			
			// Validate input
			const validated = workPackageValidation.create.parse(input);
			
			const workPackageData = withTimestamps({
				...validated,
				description: validated.description ?? null,
				priority,
				assignedTeamId: null,
				scheduledPosition: null
			});

			tx.insert(workPackages).values(workPackageData).run();

			return { id: workPackageData.id };
		});
		
		return result;
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

			db.update(workPackages).set(withUpdatedTimestamp(validated)).where(eq(workPackages.id, id)).run();
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
		db.delete(workPackages).where(eq(workPackages.id, id)).run();
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
		db.update(workPackages)
			.set(
				withUpdatedTimestamp({
					assignedTeamId: teamId,
					scheduledPosition: position
				})
			)
			.where(eq(workPackages.id, workPackageId))
			.run();
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
		db.update(workPackages)
			.set(
				withUpdatedTimestamp({
					assignedTeamId: null,
					scheduledPosition: null
				})
			)
			.where(eq(workPackages.id, workPackageId))
			.run();
	}, 'Failed to unassign work package');
}

/**
 * Batch update work package assignments and positions (for drag-and-drop functionality)
 * Updates multiple work packages atomically in a single transaction
 * @param updates - Array of work package updates with id, teamId, and position
 * @param db - Database instance (defaults to main db)
 */
export async function reorderWorkPackages(
	updates: Array<{ id: string; teamId: string | null; position: number }>,
	db: DbParam = defaultDb
): Promise<void> {
	return dbOperation(() => {
		// Use transaction for atomicity - all updates succeed or all fail
		// Note: better-sqlite3 transactions must be synchronous (no async/await)
		db.transaction((tx) => {
			for (const update of updates) {
				tx.update(workPackages)
					.set(
						withUpdatedTimestamp({
							assignedTeamId: update.teamId,
							scheduledPosition: update.position
						})
					)
					.where(eq(workPackages.id, update.id))
					.run();
			}
		});
	}, 'Failed to reorder work packages');
}

/**
 * Clear scheduled positions for all unassigned work packages
 * This makes them fall back to priority-based sorting
 * @param db - Database instance (defaults to main db)
 */
export async function clearUnassignedPositions(db: DbParam = defaultDb): Promise<void> {
	return dbOperation(() => {
		db.update(workPackages)
			.set(withUpdatedTimestamp({ scheduledPosition: null }))
			.where(isNull(workPackages.assignedTeamId))
			.run();
	}, 'Failed to clear unassigned positions');
}
