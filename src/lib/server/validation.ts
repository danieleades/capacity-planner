import { z } from 'zod';
import { YearMonth, TeamSchema, WorkPackageSchema } from '$lib/types';
import { TeamIdSchema, WorkPackageIdSchema } from '$lib/types/branded';

/**
 * Server validation schemas
 *
 * These schemas are derived from the base schemas in $lib/types/index.ts
 * to ensure consistency and avoid duplication.
 */

// YearMonth validation (reusable primitive)
const yearMonth = z.string().refine(
	(str) => YearMonth.isValid(str),
	{ message: 'Must be valid YYYY-MM with month 1-12' }
);

/**
 * Team creation validation schema
 * Derives from TeamSchema, picking required fields for creation
 */
export const createTeamSchema = z.object({
	id: TeamIdSchema,
	name: TeamSchema.shape.name.pipe(z.string().max(100)),
	monthlyCapacity: TeamSchema.shape.monthlyCapacityInPersonMonths
});

/**
 * Team update validation schema
 * All fields optional for partial updates
 */
export const updateTeamSchema = z.object({
	name: TeamSchema.shape.name.pipe(z.string().max(100)).optional(),
	monthlyCapacity: TeamSchema.shape.monthlyCapacityInPersonMonths.optional()
});

/**
 * Work package creation validation schema
 * Note: priority is computed server-side and not part of input validation
 */
export const createWorkPackageSchema = z.object({
	id: WorkPackageIdSchema,
	title: WorkPackageSchema.shape.title.pipe(z.string().max(200)),
	description: z.string().max(1000).nullable().optional(),
	sizeInPersonMonths: WorkPackageSchema.shape.sizeInPersonMonths
});

/**
 * Work package update validation schema
 * All fields optional for partial updates
 */
export const updateWorkPackageSchema = z.object({
	title: WorkPackageSchema.shape.title.pipe(z.string().max(200)).optional(),
	description: z.string().max(1000).nullable().optional(),
	sizeInPersonMonths: WorkPackageSchema.shape.sizeInPersonMonths.optional(),
	priority: WorkPackageSchema.shape.priority.optional(),
	assignedTeamId: TeamIdSchema.nullable().optional(),
	scheduledPosition: WorkPackageSchema.shape.scheduledPosition.optional(),
	progressPercent: WorkPackageSchema.shape.progressPercent.optional()
});

/**
 * Capacity override validation schema
 */
export const capacityOverrideSchema = z.object({
	id: z.uuid(),
	teamId: TeamIdSchema,
	yearMonth: yearMonth,
	capacity: z.number().nonnegative() // Allow zero for months with no capacity (e.g., holidays)
});

/**
 * Grouped validation schemas for convenience
 */
export const teamValidation = {
	create: createTeamSchema,
	update: updateTeamSchema
};

export const workPackageValidation = {
	create: createWorkPackageSchema,
	update: updateWorkPackageSchema
};

export const capacityOverrideValidation = {
	create: capacityOverrideSchema
};

/**
 * Generic validation error handler
 * Converts Zod validation errors into user-friendly error messages
 */
export function handleValidationError(error: unknown, operation: string): never {
	if (error instanceof z.ZodError) {
		const messages = error.issues.map((e) => e.message).join(', ');
		throw new Error(`Validation failed for ${operation}: ${messages}`);
	}
	throw error;
}
