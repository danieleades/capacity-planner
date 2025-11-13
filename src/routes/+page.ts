import { appState } from '$lib/stores/appState';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data }) => {
	// Initialize store with server data during load (runs on both server and client)
	appState.set(data.initialState);

	return {
		initialState: data.initialState
	};
};
