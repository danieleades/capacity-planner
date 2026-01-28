/**
 * DTO types for reorder operations
 *
 * With null/undefined unification, we use a single DTO type for all operations.
 * Uses `teamId` (null for unassigned) and `position` (0-indexed).
 */

import type { TeamId, WorkPackageId } from './branded';

/**
 * DTO for work package reorder operations
 * Used for both server communication and store updates
 */
export interface ReorderUpdate {
	id: WorkPackageId;
	teamId: TeamId | null;
	position: number;
}
