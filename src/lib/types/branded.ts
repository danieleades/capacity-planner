import { z } from 'zod';

/**
 * Branded type utility for type-safe string IDs
 * Prevents accidental mixing of TeamId and WorkPackageId at compile time
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

/**
 * Branded type for Team IDs
 */
export type TeamId = Brand<string, 'TeamId'>;

/**
 * Branded type for Work Package IDs
 */
export type WorkPackageId = Brand<string, 'WorkPackageId'>;

/**
 * Unsafe constructor for TeamId - use only when reading from database/JSON
 */
export const unsafeTeamId = (id: string): TeamId => id as TeamId;

/**
 * Unsafe constructor for WorkPackageId - use only when reading from database/JSON
 */
export const unsafeWorkPackageId = (id: string): WorkPackageId => id as WorkPackageId;

/**
 * Generate a new TeamId using crypto.randomUUID()
 */
export const generateTeamId = (): TeamId => crypto.randomUUID() as TeamId;

/**
 * Generate a new WorkPackageId using crypto.randomUUID()
 */
export const generateWorkPackageId = (): WorkPackageId => crypto.randomUUID() as WorkPackageId;

/**
 * Zod schema for TeamId with UUID validation and type transformation
 */
export const TeamIdSchema = z.uuid().transform(unsafeTeamId);

/**
 * Zod schema for WorkPackageId with UUID validation and type transformation
 */
export const WorkPackageIdSchema = z.uuid().transform(unsafeWorkPackageId);
