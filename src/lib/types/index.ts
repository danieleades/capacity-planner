import { z } from 'zod';

// Zod schemas - single source of truth
export const MonthlyCapacitySchema = z.object({
	yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Must be in YYYY-MM format'),
	capacity: z.number().nonnegative('Capacity must be non-negative')
});

export const TeamSchema = z
	.object({
		id: z.string().min(1, 'Team ID is required'),
		name: z.string().min(1, 'Team name is required'),
		monthlyCapacityInPersonMonths: z.number().nonnegative('Capacity must be non-negative'),
		capacityOverrides: z.array(MonthlyCapacitySchema).default([])
	})
	.extend({
		clientId: z.uuid().optional()
	});

export const WorkPackageSchema = z
	.object({
		id: z.string().min(1, 'Work package ID is required'),
		title: z.string().min(1, 'Title is required'),
		description: z.string().optional(),
		sizeInPersonMonths: z.number().positive('Size must be positive'),
		priority: z.number().int().nonnegative('Priority must be a non-negative integer'),
		assignedTeamId: z.string().optional(),
		scheduledPosition: z.number().int().nonnegative().optional()
	})
	.extend({
		clientId: z.uuid().optional()
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
	initialState: AppStateSchema
});

// TypeScript types inferred from Zod schemas
export type MonthlyCapacity = z.infer<typeof MonthlyCapacitySchema>;
export type Team = z.infer<typeof TeamSchema>;
export type WorkPackage = z.infer<typeof WorkPackageSchema>;
export type AppState = z.infer<typeof AppStateSchema>;
export type PlanningPageData = z.infer<typeof PlanningPageDataSchema>;
