import type { PageServerLoad } from './$types';
import { readState } from '$lib/server/storage';

export const load: PageServerLoad = async () => {
	const state = await readState();
	return {
		initialState: state
	};
};
