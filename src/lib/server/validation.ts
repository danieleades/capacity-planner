import { z } from 'zod';

/**
 * Reusable validation primitives
 */
const yearMonth = z.string().regex(/^\d{4}-\d{2}$/);
const positiveNumber = z.number().positive();
const nonNegativeNumber = z.number().nonnegative();
const nonNegativeInt = z.number().int().nonnegative();

/**
 * Team creation validation schema
 */
export const createTeamSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1).max(100),
	monthlyCapacity: nonNegativeNumber
});

/**
 * Team update validation schema
 */
export const updateTeamSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	monthlyCapacity: nonNegativeNumber.optional()
});

/**
 * Work package creation validation schema
 * Note: priority is computed server-side and not part of input validation
 */
export const createWorkPackageSchema = z.object({
	id: z.uuid(),
	title: z.string().min(1).max(200),
	description: z.string().max(1000).optional(),
	sizeInPersonMonths: positiveNumber
});

/**
 * Work package update validation schema
 */
export const updateWorkPackageSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	description: z.string().max(1000).optional().nullable(),
	sizeInPersonMonths: positiveNumber.optional(),
	priority: nonNegativeInt.optional(),
	assignedTeamId: z.uuid().optional().nullable(),
	scheduledPosition: nonNegativeInt.optional().nullable(),
	progressPercent: z.number().int().min(0).max(100).optional()
});

/**
 * Capacity override validation schema
 */
export const capacityOverrideSchema = z.object({
	id: z.uuid(),
	teamId: z.uuid(),
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
