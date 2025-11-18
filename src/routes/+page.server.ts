import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { getPlanningView } from '$lib/server/repositories/planning.repository';
import {
	createWorkPackage,
	updateWorkPackage,
	deleteWorkPackage,
	assignWorkPackage,
	unassignWorkPackage
} from '$lib/server/repositories/work-packages.repository';
import { setCapacityOverride } from '$lib/server/repositories/teams.repository';

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

export const load: PageServerLoad = async () => {
	try {
		const planningView = getPlanningView();
		return {
			planningView
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
			if (isNaN(capacity) || capacity <= 0) {
				return fail(400, {
					error: 'Invalid capacity value',
					details: 'Capacity must be a positive number'
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
				priority?: number;
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

			const priorityStr = data.get('priority') as string | null;
			if (priorityStr !== null) {
				const priority = parseInt(priorityStr, 10);
				if (isNaN(priority) || priority < 0) {
					return fail(400, {
						error: 'Invalid priority',
						details: 'Priority must be a non-negative integer'
					});
				}
				updateData.priority = priority;
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
		try {
			const data = await request.formData();
			const title = data.get('title') as string;
			const description = data.get('description') as string | null;
			const sizeStr = data.get('sizeInPersonMonths') as string;
			const priorityStr = data.get('priority') as string;

			if (!title || !sizeStr || !priorityStr) {
				return fail(400, {
					error: 'Missing required fields',
					details: 'Title, size, and priority are required'
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

			const priority = parseInt(priorityStr, 10);
			if (isNaN(priority) || priority < 0) {
				return fail(400, {
					error: 'Invalid priority',
					details: 'Priority must be a non-negative integer'
				});
			}

			const result = await createWorkPackage({
				title: title.trim(),
				description: description?.trim() || undefined,
				sizeInPersonMonths,
				priority
			});

			return { success: true, id: result.id };
		} catch (error) {
			console.error('Failed to create work package:', error);
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
	}
};
