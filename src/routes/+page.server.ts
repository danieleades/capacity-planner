import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { getPlanningView } from '$lib/server/repositories/planning.repository';
import {
	createWorkPackage,
	updateWorkPackage,
	deleteWorkPackage,
	assignWorkPackage,
	unassignWorkPackage,
	reorderWorkPackages
} from '$lib/server/repositories/work-packages.repository';
import {
	setCapacityOverride,
	createTeam,
	updateTeam,
	deleteTeam
} from '$lib/server/repositories/teams.repository';
import { clearUnassignedPositions } from '$lib/server/repositories/work-packages.repository';

/**
 * Format error messages for user-friendly display
 */
function formatErrorMessage(error: unknown): string {
	if (error instanceof ZodError) {
		// Format Zod validation errors
		const messages = error.issues.map((issue) => {
			const path = issue.path.join('.');
			return path ? `${path}: ${issue.message}` : issue.message;
		});
		return `Validation error: ${messages.join(', ')}`;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return 'An unexpected error occurred';
}

/**
 * Check if error is a SQLite PRIMARY KEY constraint violation
 */
function isPrimaryKeyViolation(error: unknown): boolean {
	if (error && typeof error === 'object' && 'code' in error) {
		const code = (error as { code: string }).code;
		return code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || code === 'SQLITE_CONSTRAINT';
	}
	return false;
}

export const load: PageServerLoad = async () => {
	try {
		const planningView = getPlanningView();
		
		// Transform PlanningView into AppState format (flat arrays)
		// Flatten work packages from all teams and unassigned into a single array
		const allWorkPackages = [
			...planningView.unassignedWorkPackages.map(wp => ({
				id: wp.id,
				title: wp.title,
				description: wp.description || undefined,
				sizeInPersonMonths: wp.sizeInPersonMonths,
				priority: wp.priority,
				assignedTeamId: undefined,
				scheduledPosition: wp.scheduledPosition ?? undefined,
				progressPercent: wp.progressPercent
			})),
			...planningView.teams.flatMap(team =>
				team.workPackages.map(wp => ({
					id: wp.id,
					title: wp.title,
					description: wp.description || undefined,
					sizeInPersonMonths: wp.sizeInPersonMonths,
					priority: wp.priority,
					assignedTeamId: team.id,
					scheduledPosition: wp.scheduledPosition ?? undefined,
					progressPercent: wp.progressPercent
				}))
			)
		];

		// Transform teams into AppState format
		const allTeams = planningView.teams.map(team => ({
			id: team.id,
			name: team.name,
			monthlyCapacityInPersonMonths: team.monthlyCapacity,
			capacityOverrides: team.capacityOverrides.map(override => ({
				yearMonth: override.yearMonth,
				capacity: override.capacity
			}))
		}));

		return {
			initialState: {
				teams: allTeams,
				workPackages: allWorkPackages
			}
		};
	} catch (error) {
		console.error('Failed to load planning view:', error);
		throw error;
	}
};

export const actions: Actions = {
	updateCapacity: async ({ request }) => {
		try {
			const data = await request.formData();
			const teamId = data.get('teamId') as string;
			const yearMonth = data.get('yearMonth') as string;
			const capacityStr = data.get('capacity') as string;

			if (!teamId || !yearMonth || !capacityStr) {
				return fail(400, {
					error: 'Missing required fields',
					details: 'Please provide teamId, yearMonth, and capacity'
				});
			}

			const capacity = parseFloat(capacityStr);
			if (isNaN(capacity) || capacity < 0) {
				return fail(400, {
					error: 'Invalid capacity value',
					details: 'Capacity must be a non-negative number'
				});
			}

			await setCapacityOverride(teamId, yearMonth, capacity);
			return { success: true };
		} catch (error) {
			console.error('Failed to update capacity:', error);
			return fail(500, {
				error: 'Failed to update capacity',
				details: formatErrorMessage(error)
			});
		}
	},

	assignWorkPackage: async ({ request }) => {
		try {
			const data = await request.formData();
			const workPackageId = data.get('workPackageId') as string;
			const teamId = data.get('teamId') as string;
			const positionStr = data.get('position') as string;

			if (!workPackageId) {
				return fail(400, {
					error: 'Missing work package ID',
					details: 'Work package ID is required'
				});
			}

			// If teamId is null or empty, unassign the work package
			if (!teamId) {
				await unassignWorkPackage(workPackageId);
				return { success: true };
			}

			// Validate that the team exists before assignment
			const planningView = getPlanningView();
			const teamExists = planningView.teams.some(team => team.id === teamId);
			
			if (!teamExists) {
				return fail(400, {
					error: 'Invalid team assignment',
					details: `Team with ID ${teamId} does not exist`
				});
			}

			const position = positionStr ? parseInt(positionStr, 10) : 0;
			if (isNaN(position) || position < 0) {
				return fail(400, {
					error: 'Invalid position value',
					details: 'Position must be a non-negative integer'
				});
			}

			await assignWorkPackage(workPackageId, teamId, position);
			return { success: true };
		} catch (error) {
			console.error('Failed to assign work package:', error);
			return fail(500, {
				error: 'Failed to assign work package',
				details: formatErrorMessage(error)
			});
		}
	},

	updateWorkPackage: async ({ request }) => {
		try {
			const data = await request.formData();
			const id = data.get('id') as string;

			if (!id) {
				return fail(400, {
					error: 'Missing work package ID',
					details: 'Work package ID is required'
				});
			}

			const updateData: {
				title?: string;
				description?: string | null;
				sizeInPersonMonths?: number;
				progressPercent?: number;
			} = {};

			const title = data.get('title') as string | null;
			if (title !== null) {
				if (title.trim().length === 0) {
					return fail(400, {
						error: 'Invalid title',
						details: 'Title cannot be empty'
					});
				}
				updateData.title = title;
			}

			const description = data.get('description') as string | null;
			if (description !== null) {
				updateData.description = description || null;
			}

			const sizeStr = data.get('sizeInPersonMonths') as string | null;
			if (sizeStr !== null) {
				const size = parseFloat(sizeStr);
				if (isNaN(size) || size <= 0) {
					return fail(400, {
						error: 'Invalid size',
						details: 'Size must be a positive number'
					});
				}
				updateData.sizeInPersonMonths = size;
			}

			const progressStr = data.get('progressPercent') as string | null;
			if (progressStr !== null) {
				const progress = parseInt(progressStr, 10);
				if (isNaN(progress) || progress < 0 || progress > 100) {
					return fail(400, {
						error: 'Invalid progress',
						details: 'Progress must be a number between 0 and 100'
					});
				}
				updateData.progressPercent = progress;
			}

			await updateWorkPackage(id, updateData);
			return { success: true };
		} catch (error) {
			console.error('Failed to update work package:', error);
			return fail(500, {
				error: 'Failed to update work package',
				details: formatErrorMessage(error)
			});
		}
	},

	createWorkPackage: async ({ request }) => {
		let workPackageId: string | null = null;
		try {
			const data = await request.formData();
			const idValue = data.get('id');
			workPackageId = typeof idValue === 'string' && idValue.length > 0 ? idValue : null;
			const title = data.get('title') as string;
			const description = data.get('description') as string | null;
			const sizeStr = data.get('sizeInPersonMonths') as string;

			if (!workPackageId) {
				return fail(400, {
					error: 'Missing work package ID',
					details: 'Work package ID is required'
				});
			}

			if (!title || !sizeStr) {
				return fail(400, {
					error: 'Missing required fields',
					details: 'Title and size are required'
				});
			}

			if (title.trim().length === 0) {
				return fail(400, {
					error: 'Invalid title',
					details: 'Title cannot be empty'
				});
			}

			const sizeInPersonMonths = parseFloat(sizeStr);
			if (isNaN(sizeInPersonMonths) || sizeInPersonMonths <= 0) {
				return fail(400, {
					error: 'Invalid size',
					details: 'Size must be a positive number'
				});
			}

			const result = await createWorkPackage({
				id: workPackageId,
				title: title.trim(),
				description: description?.trim() || undefined,
				sizeInPersonMonths
			});

			return { success: true, id: result.id ?? workPackageId };
		} catch (error) {
			console.error('Failed to create work package:', error);

			// Check for PRIMARY KEY constraint violation (duplicate ID)
			if (isPrimaryKeyViolation(error)) {
				return fail(409, {
					error: 'Duplicate work package ID',
					details: `A work package with ID ${workPackageId} already exists`
				});
			}

			return fail(500, {
				error: 'Failed to create work package',
				details: formatErrorMessage(error)
			});
		}
	},

	deleteWorkPackage: async ({ request }) => {
		try {
			const data = await request.formData();
			const id = data.get('id') as string;

			if (!id) {
				return fail(400, {
					error: 'Missing work package ID',
					details: 'Work package ID is required'
				});
			}

			await deleteWorkPackage(id);
			return { success: true };
		} catch (error) {
			console.error('Failed to delete work package:', error);
			return fail(500, {
				error: 'Failed to delete work package',
				details: formatErrorMessage(error)
			});
		}
	},

	createTeam: async ({ request }) => {
		let providedId: string | null = null;
		try {
			const data = await request.formData();
			const idValue = data.get('id');
			providedId = typeof idValue === 'string' && idValue.length > 0 ? idValue : null;
			const name = data.get('name') as string;
			const monthlyCapacityStr = data.get('monthlyCapacity') as string;

			if (!name || !monthlyCapacityStr) {
				return fail(400, {
					error: 'Missing required fields',
					details: 'Name and monthly capacity are required'
				});
			}

			if (name.trim().length === 0) {
				return fail(400, {
					error: 'Invalid name',
					details: 'Name cannot be empty'
				});
			}

			const monthlyCapacity = parseFloat(monthlyCapacityStr);
			if (isNaN(monthlyCapacity) || monthlyCapacity <= 0) {
				return fail(400, {
					error: 'Invalid monthly capacity',
					details: 'Monthly capacity must be a positive number'
				});
			}

			if (!providedId) {
				return fail(400, {
					error: 'Missing team ID',
					details: 'Team ID must be provided'
				});
			}

			const result = await createTeam({
				id: providedId,
				name: name.trim(),
				monthlyCapacity
			});

			return { success: true, id: result.id ?? providedId };
		} catch (error) {
			console.error('Failed to create team:', error);

			// Check for PRIMARY KEY constraint violation (duplicate ID)
			if (isPrimaryKeyViolation(error)) {
				return fail(409, {
					error: 'Duplicate team ID',
					details: `A team with ID ${providedId} already exists`
				});
			}

			return fail(500, {
				error: 'Failed to create team',
				details: formatErrorMessage(error)
			});
		}
	},

	updateTeam: async ({ request }) => {
		try {
			const data = await request.formData();
			const id = data.get('id') as string;

			if (!id) {
				return fail(400, {
					error: 'Missing team ID',
					details: 'Team ID is required'
				});
			}

			const updateData: {
				name?: string;
				monthlyCapacity?: number;
			} = {};

			const name = data.get('name') as string | null;
			if (name !== null) {
				if (name.trim().length === 0) {
					return fail(400, {
						error: 'Invalid name',
						details: 'Name cannot be empty'
					});
				}
				updateData.name = name.trim();
			}

			const monthlyCapacityStr = data.get('monthlyCapacity') as string | null;
			if (monthlyCapacityStr !== null) {
				const monthlyCapacity = parseFloat(monthlyCapacityStr);
				if (isNaN(monthlyCapacity) || monthlyCapacity <= 0) {
					return fail(400, {
						error: 'Invalid monthly capacity',
						details: 'Monthly capacity must be a positive number'
					});
				}
				updateData.monthlyCapacity = monthlyCapacity;
			}

			await updateTeam(id, updateData);
			return { success: true };
		} catch (error) {
			console.error('Failed to update team:', error);
			return fail(500, {
				error: 'Failed to update team',
				details: formatErrorMessage(error)
			});
		}
	},

	deleteTeam: async ({ request }) => {
		try {
			const data = await request.formData();
			const id = data.get('id') as string;

			if (!id) {
				return fail(400, {
					error: 'Missing team ID',
					details: 'Team ID is required'
				});
			}

			await deleteTeam(id);
			return { success: true };
		} catch (error) {
			console.error('Failed to delete team:', error);
			return fail(500, {
				error: 'Failed to delete team',
				details: formatErrorMessage(error)
			});
		}
	},

	reorderWorkPackages: async ({ request }) => {
		try {
			const data = await request.formData();
			const updatesJson = data.get('updates') as string;

			if (!updatesJson) {
				return fail(400, {
					error: 'Missing updates data',
					details: 'Updates array is required'
				});
			}

			let updates: Array<{ id: string; teamId: string | null; position: number }>;
			try {
				updates = JSON.parse(updatesJson);
			} catch {
				return fail(400, {
					error: 'Invalid updates format',
					details: 'Updates must be valid JSON'
				});
			}

			// Validate updates array
			if (!Array.isArray(updates) || updates.length === 0) {
				return fail(400, {
					error: 'Invalid updates array',
					details: 'Updates must be a non-empty array'
				});
			}

			// Validate each update object
			for (const update of updates) {
				if (!update.id || typeof update.id !== 'string') {
					return fail(400, {
						error: 'Invalid update object',
						details: 'Each update must have a valid id'
					});
				}
				if (update.teamId !== null && typeof update.teamId !== 'string') {
					return fail(400, {
						error: 'Invalid update object',
						details: 'teamId must be a string or null'
					});
				}
				if (typeof update.position !== 'number' || update.position < 0) {
					return fail(400, {
						error: 'Invalid update object',
						details: 'position must be a non-negative number'
					});
				}
			}

			await reorderWorkPackages(updates);
			return { success: true };
		} catch (error) {
			console.error('Failed to reorder work packages:', error);
			return fail(500, {
				error: 'Failed to reorder work packages',
				details: formatErrorMessage(error)
			});
		}
	},

	clearUnassignedPositions: async () => {
		try {
			await clearUnassignedPositions();
			return { success: true };
		} catch (error) {
			console.error('Failed to clear unassigned positions:', error);
			return fail(500, {
				error: 'Failed to reset to priority order',
				details: formatErrorMessage(error)
			});
		}
	}
};
