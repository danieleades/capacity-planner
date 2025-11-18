import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data }) => {
	// Server already returns data in the correct initialState format
	// Just pass it through
	return data;
};
