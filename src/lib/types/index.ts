import { z } from 'zod';

import { YearMonth } from './YearMonth';
export { YearMonth };
export * from './dto';

// YearMonth schema with proper validation (month 1-12)
export const YearMonthSchema = z.string().refine(
	(str) => YearMonth.isValid(str),
	{ message: 'Must be valid YYYY-MM with month 1-12' }
);

// Zod schemas - single source of truth
export const MonthlyCapacitySchema = z.object({
	yearMonth: YearMonthSchema,
	capacity: z.number().nonnegative('Capacity must be non-negative')
});

export const TeamSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1, 'Team name is required'),
	monthlyCapacityInPersonMonths: z.number().nonnegative('Capacity must be non-negative'),
	capacityOverrides: z.array(MonthlyCapacitySchema).default([])
});

export const WorkPackageSchema = z.object({
	id: z.uuid(),
	title: z.string().min(1, 'Title is required'),
	description: z.string().optional(),
	sizeInPersonMonths: z.number().positive('Size must be positive'),
	priority: z.number().int().nonnegative('Priority must be a non-negative integer'),
	assignedTeamId: z.uuid().optional(),
	scheduledPosition: z.number().int().nonnegative().optional(),
	progressPercent: z.number().int().min(0).max(100).default(0)
});

export const AppStateSchema = z
	.object({
		teams: z.array(TeamSchema),
		workPackages: z.array(WorkPackageSchema)
	})
	.refine(
		(data) => {
			// Validate that all assignedTeamId references exist in teams
			const teamIds = new Set(data.teams.map((t) => t.id));
			const invalidRefs = data.workPackages
				.filter((wp) => wp.assignedTeamId !== undefined && !teamIds.has(wp.assignedTeamId))
				.map((wp) => wp.id);

			return invalidRefs.length === 0;
		},
		{
			message: 'Work packages reference non-existent teams',
			path: ['workPackages']
		}
	);

export const PlanningPageDataSchema = z.object({
	initialState: AppStateSchema,
	planningStartDate: z.date()
});

// TypeScript types inferred from Zod schemas
export type MonthlyCapacity = z.infer<typeof MonthlyCapacitySchema>;
export type Team = z.infer<typeof TeamSchema>;
export type WorkPackage = z.infer<typeof WorkPackageSchema>;
export type AppState = z.infer<typeof AppStateSchema>;
export type PlanningPageData = z.infer<typeof PlanningPageDataSchema>;
