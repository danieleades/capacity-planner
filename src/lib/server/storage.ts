import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { AppState } from '$lib/types';

// Resolve data directory relative to project root (not CWD)
// In SvelteKit, __dirname is not available in ES modules, so we use process.cwd()
// which points to the project root when running via `npm run dev` or `node build`
const PROJECT_ROOT = process.cwd();
const DATA_DIR = join(PROJECT_ROOT, 'data');
const STATE_FILE = 'app-state.json';
const DEMO_FILE = 'demo-state.json';

/**
 * Get the appropriate file path based on environment
 * Demo mode must be explicitly enabled via DEMO_MODE=true
 */
function getStatePath(): string {
	// Demo mode is opt-in - must explicitly set DEMO_MODE=true
	const isDemoMode = process.env.DEMO_MODE === 'true';
	const filename = isDemoMode ? DEMO_FILE : STATE_FILE;
	return join(DATA_DIR, filename);
}

/**
 * Ensure the data directory exists
 */
async function ensureDataDir(): Promise<void> {
	if (!existsSync(DATA_DIR)) {
		await mkdir(DATA_DIR, { recursive: true });
	}
}

/**
 * Initialize state file with empty state if it doesn't exist
 */
async function initializeState(): Promise<AppState> {
	const emptyState: AppState = {
		teams: [],
		workPackages: []
	};

	await ensureDataDir();
	const statePath = getStatePath();

	if (!existsSync(statePath)) {
		await writeFile(statePath, JSON.stringify(emptyState, null, 2), 'utf-8');
	}

	return emptyState;
}

/**
 * Read application state from file
 */
export async function readState(): Promise<AppState> {
	try {
		await ensureDataDir();
		const statePath = getStatePath();

		if (!existsSync(statePath)) {
			return await initializeState();
		}

		const data = await readFile(statePath, 'utf-8');
		return JSON.parse(data) as AppState;
	} catch (error) {
		console.error('Error reading state:', error);
		// Return empty state on error
		return { teams: [], workPackages: [] };
	}
}

/**
 * Write application state to file atomically using temp file + rename
 * This prevents corruption if the process crashes mid-write
 */
export async function writeState(state: AppState): Promise<void> {
	try {
		await ensureDataDir();
		const statePath = getStatePath();
		const tempPath = `${statePath}.tmp`;

		// Write to temporary file first
		await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');

		// Atomically replace the target file
		await rename(tempPath, statePath);
	} catch (error) {
		console.error('Error writing state:', error);
		throw new Error('Failed to save state');
	}
}
