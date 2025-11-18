import { z } from 'zod';

export interface WorkPackage {
	id: string;
	title: string;
	description?: string;
	sizeInPersonMonths: number;
	priority: number; // lower = higher priority (global canonical ordering)
	assignedTeamId?: string;
	scheduledPosition?: number; // Optional: board view sequencing for planning/phasing
}

export interface MonthlyCapacity {
	yearMonth: string; // Format: "YYYY-MM"
	capacity: number; // person-months
}

export interface Team {
	id: string;
	name: string;
	monthlyCapacityInPersonMonths: number; // Default capacity
	capacityOverrides?: MonthlyCapacity[]; // Optional per-month overrides
}

export interface AppState {
	workPackages: WorkPackage[];
	teams: Team[];
}

/**
 * Page data shape for the planning route
 * This is the canonical type that the route's load function returns
 */
export interface PlanningPageData {
	initialState: AppState;
}

// Zod schemas for validation
export const MonthlyCapacitySchema = z.object({
	yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Must be in YYYY-MM format'),
	capacity: z.number().nonnegative('Capacity must be non-negative')
});

export const TeamSchema = z.object({
	id: z.string().min(1, 'Team ID is required'),
	name: z.string().min(1, 'Team name is required'),
	monthlyCapacityInPersonMonths: z.number().nonnegative('Capacity must be non-negative'),
	capacityOverrides: z.array(MonthlyCapacitySchema).optional()
});

export const WorkPackageSchema = z.object({
	id: z.string().min(1, 'Work package ID is required'),
	title: z.string().min(1, 'Title is required'),
	description: z.string().optional(),
	sizeInPersonMonths: z.number().positive('Size must be positive'),
	priority: z.number().int().nonnegative('Priority must be a non-negative integer'),
	assignedTeamId: z.string().optional(),
	scheduledPosition: z.number().int().nonnegative().optional()
});

export const AppStateSchema = z.object({
	teams: z.array(TeamSchema),
	workPackages: z.array(WorkPackageSchema)
}).refine((data) => {
	// Validate that all assignedTeamId references exist in teams
	const teamIds = new Set(data.teams.map(t => t.id));
	const invalidRefs = data.workPackages
		.filter(wp => wp.assignedTeamId !== undefined && !teamIds.has(wp.assignedTeamId))
		.map(wp => wp.id);

	return invalidRefs.length === 0;
}, {
	message: 'Work packages reference non-existent teams',
	path: ['workPackages']
});
