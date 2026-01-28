import { z } from 'zod';

import { YearMonth } from './YearMonth';
export { YearMonth };
export * from './dto';
export * from './branded';

// YearMonth schema with proper validation (month 1-12)
export const YearMonthSchema = z.string().refine(
	(str) => YearMonth.isValid(str),
	{ message: 'Must be valid YYYY-MM with month 1-12' }
);

// Import branded ID schemas for type-safe IDs
import { TeamIdSchema, WorkPackageIdSchema } from './branded';

// Zod schemas - single source of truth
export const MonthlyCapacitySchema = z.object({
	yearMonth: YearMonthSchema,
	capacity: z.number().nonnegative('Capacity must be non-negative')
});

export const TeamSchema = z.object({
	id: TeamIdSchema,
	name: z.string().min(1, 'Team name is required'),
	monthlyCapacityInPersonMonths: z.number().nonnegative('Capacity must be non-negative'),
	capacityOverrides: z.array(MonthlyCapacitySchema).default([])
});

export const WorkPackageSchema = z.object({
	id: WorkPackageIdSchema,
	title: z.string().min(1, 'Title is required'),
	description: z.string().nullable().default(null),
	sizeInPersonMonths: z.number().positive('Size must be positive'),
	priority: z.number().int().nonnegative('Priority must be a non-negative integer'),
	assignedTeamId: TeamIdSchema.nullable().default(null),
	scheduledPosition: z.number().int().nonnegative().nullable().default(null),
	progressPercent: z.number().int().min(0).max(100).default(0)
});

// TypeScript types inferred from Zod schemas
export type MonthlyCapacity = z.infer<typeof MonthlyCapacitySchema>;
export type Team = z.infer<typeof TeamSchema>;
export type WorkPackage = z.infer<typeof WorkPackageSchema>;
export type AppState = {
	teams: Team[];
	workPackages: WorkPackage[];
};
export type PlanningPageData = {
	initialState: AppState;
	planningStartDate: Date;
};
