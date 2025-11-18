import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getPlanningView } from '$lib/server/repositories/planning.repository';
import {
	createWorkPackage,
	updateWorkPackage,
	deleteWorkPackage,
	assignWorkPackage,
	unassignWorkPackage
} from '$lib/server/repositories/work-packages.repository';
import { setCapacityOverride } from '$lib/server/repositories/teams.repository';

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
				return fail(400, { error: 'Missing required fields: teamId, yearMonth, or capacity' });
			}

			const capacity = parseFloat(capacityStr);
			if (isNaN(capacity)) {
				return fail(400, { error: 'Invalid capacity value' });
			}

			await setCapacityOverride(teamId, yearMonth, capacity);
			return { success: true };
		} catch (error) {
			console.error('Failed to update capacity:', error);
			const message = error instanceof Error ? error.message : 'Failed to update capacity';
			return fail(500, { error: message });
		}
	},

	assignWorkPackage: async ({ request }) => {
		try {
			const data = await request.formData();
			const workPackageId = data.get('workPackageId') as string;
			const teamId = data.get('teamId') as string;
			const positionStr = data.get('position') as string;

			if (!workPackageId) {
				return fail(400, { error: 'Missing required field: workPackageId' });
			}

			// If teamId is null or empty, unassign the work package
			if (!teamId) {
				await unassignWorkPackage(workPackageId);
				return { success: true };
			}

			const position = positionStr ? parseInt(positionStr, 10) : 0;
			if (isNaN(position)) {
				return fail(400, { error: 'Invalid position value' });
			}

			await assignWorkPackage(workPackageId, teamId, position);
			return { success: true };
		} catch (error) {
			console.error('Failed to assign work package:', error);
			const message = error instanceof Error ? error.message : 'Failed to assign work package';
			return fail(500, { error: message });
		}
	},

	updateWorkPackage: async ({ request }) => {
		try {
			const data = await request.formData();
			const id = data.get('id') as string;

			if (!id) {
				return fail(400, { error: 'Missing required field: id' });
			}

			const updateData: {
				title?: string;
				description?: string | null;
				sizeInPersonMonths?: number;
				priority?: number;
			} = {};

			const title = data.get('title') as string | null;
			if (title !== null) {
				updateData.title = title;
			}

			const description = data.get('description') as string | null;
			if (description !== null) {
				updateData.description = description || null;
			}

			const sizeStr = data.get('sizeInPersonMonths') as string | null;
			if (sizeStr !== null) {
				const size = parseFloat(sizeStr);
				if (isNaN(size)) {
					return fail(400, { error: 'Invalid sizeInPersonMonths value' });
				}
				updateData.sizeInPersonMonths = size;
			}

			const priorityStr = data.get('priority') as string | null;
			if (priorityStr !== null) {
				const priority = parseInt(priorityStr, 10);
				if (isNaN(priority)) {
					return fail(400, { error: 'Invalid priority value' });
				}
				updateData.priority = priority;
			}

			await updateWorkPackage(id, updateData);
			return { success: true };
		} catch (error) {
			console.error('Failed to update work package:', error);
			const message = error instanceof Error ? error.message : 'Failed to update work package';
			return fail(500, { error: message });
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
					error: 'Missing required fields: title, sizeInPersonMonths, or priority'
				});
			}

			const sizeInPersonMonths = parseFloat(sizeStr);
			if (isNaN(sizeInPersonMonths)) {
				return fail(400, { error: 'Invalid sizeInPersonMonths value' });
			}

			const priority = parseInt(priorityStr, 10);
			if (isNaN(priority)) {
				return fail(400, { error: 'Invalid priority value' });
			}

			const result = await createWorkPackage({
				title,
				description: description || undefined,
				sizeInPersonMonths,
				priority
			});

			return { success: true, id: result.id };
		} catch (error) {
			console.error('Failed to create work package:', error);
			const message = error instanceof Error ? error.message : 'Failed to create work package';
			return fail(500, { error: message });
		}
	},

	deleteWorkPackage: async ({ request }) => {
		try {
			const data = await request.formData();
			const id = data.get('id') as string;

			if (!id) {
				return fail(400, { error: 'Missing required field: id' });
			}

			await deleteWorkPackage(id);
			return { success: true };
		} catch (error) {
			console.error('Failed to delete work package:', error);
			const message = error instanceof Error ? error.message : 'Failed to delete work package';
			return fail(500, { error: message });
		}
	}
};
