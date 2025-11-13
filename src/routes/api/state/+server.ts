import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readState, writeState } from '$lib/server/storage';
import { AppStateSchema } from '$lib/types';
import { ZodError } from 'zod';

/**
 * GET /api/state
 * Returns the current application state
 */
export const GET: RequestHandler = async () => {
	try {
		const state = await readState();
		return json(state);
	} catch (error) {
		console.error('Failed to read state:', error);
		return json({ error: 'Failed to load state' }, { status: 500 });
	}
};

/**
 * PUT /api/state
 * Saves the application state with full schema validation
 */
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		// Validate with Zod schema
		const validationResult = AppStateSchema.safeParse(data);

		if (!validationResult.success) {
			const errors = validationResult.error.issues.map((issue) => ({
				path: issue.path.join('.'),
				message: issue.message
			}));
			return json({
				error: 'Invalid state data',
				details: errors
			}, { status: 400 });
		}

		await writeState(validationResult.data);
		return json({ success: true });
	} catch (error) {
		if (error instanceof ZodError) {
			return json({ error: 'Validation error', details: error.issues }, { status: 400 });
		}
		console.error('Failed to write state:', error);
		return json({ error: 'Failed to save state' }, { status: 500 });
	}
};
