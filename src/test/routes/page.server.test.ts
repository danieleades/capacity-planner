import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { createTestDb, clearTestDb, closeTestDb } from '../utils/test-db';
import { load, actions } from '../../routes/+page.server';
import { createTeam, setCapacityOverride } from '$lib/server/repositories/teams.repository';
import type { CreateTeamInput } from '$lib/server/repositories/teams.repository';
import { createWorkPackage, assignWorkPackage } from '$lib/server/repositories/work-packages.repository';
import type { CreateWorkPackageInput } from '$lib/server/repositories/work-packages.repository';
import type { RequestEvent } from '@sveltejs/kit';
import type { WorkPackage } from '$lib/types';

// Mock the repository modules to use our test database
let testDb: ReturnType<typeof createTestDb>['db'];
let testSqlite: ReturnType<typeof createTestDb>['sqlite'];

const buildTeamInput = (overrides: Partial<CreateTeamInput> = {}): CreateTeamInput => ({
	id: crypto.randomUUID(),
	name: 'Test Team',
	monthlyCapacity: 1,
	...overrides
});

const buildWorkPackageInput = (
	overrides: Partial<CreateWorkPackageInput> = {}
): CreateWorkPackageInput => ({
	id: crypto.randomUUID(),
	title: 'Test Work Package',
	sizeInPersonMonths: 1,
	...overrides
});

function insertTeam(overrides: Partial<CreateTeamInput> = {}) {
	return createTeam(buildTeamInput(overrides), testDb);
}

function insertWorkPackage(overrides: Partial<CreateWorkPackageInput> = {}) {
	return createWorkPackage(buildWorkPackageInput(overrides), testDb);
}

// Helper type for creating mock request events
type MockRequestEvent = Pick<RequestEvent, 'request'>;

// Helper function to create a mock request with FormData
function createMockRequest(formData: FormData): MockRequestEvent {
	return {
		request: {
			formData: async () => formData
		} as Request
	};
}

// Helper function to check error messages in action results
function expectErrorMessage(result: unknown, expectedMessage: string): void {
	if (result && typeof result === 'object' && 'data' in result) {
		const data = (result as { data: unknown }).data;
		if (data && typeof data === 'object' && 'error' in data) {
			expect((data as { error: string }).error).toContain(expectedMessage);
		}
	}
}

vi.mock('$lib/server/repositories/planning.repository', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/repositories/planning.repository')>(
		'$lib/server/repositories/planning.repository'
	);
	return {
		getPlanningView: () => actual.getPlanningView(testDb)
	};
});

vi.mock('$lib/server/repositories/teams.repository', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/repositories/teams.repository')>(
		'$lib/server/repositories/teams.repository'
	);
	return {
		createTeam: (input: Parameters<typeof actual.createTeam>[0]) => actual.createTeam(input, testDb),
		updateTeam: (id: string, input: Parameters<typeof actual.updateTeam>[1]) =>
			actual.updateTeam(id, input, testDb),
		deleteTeam: (id: string) => actual.deleteTeam(id, testDb),
		setCapacityOverride: (
			teamId: string,
			yearMonth: string,
			capacity: number
		) => actual.setCapacityOverride(teamId, yearMonth, capacity, testDb)
	};
});

vi.mock('$lib/server/repositories/work-packages.repository', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/repositories/work-packages.repository')>(
		'$lib/server/repositories/work-packages.repository'
	);
	return {
		createWorkPackage: (input: Parameters<typeof actual.createWorkPackage>[0]) =>
			actual.createWorkPackage(input, testDb),
		updateWorkPackage: (id: string, input: Parameters<typeof actual.updateWorkPackage>[1]) =>
			actual.updateWorkPackage(id, input, testDb),
		deleteWorkPackage: (id: string) => actual.deleteWorkPackage(id, testDb),
		assignWorkPackage: (workPackageId: string, teamId: string, position: number) =>
			actual.assignWorkPackage(workPackageId, teamId, position, testDb),
		unassignWorkPackage: (workPackageId: string) => actual.unassignWorkPackage(workPackageId, testDb),
		reorderWorkPackages: (updates: Parameters<typeof actual.reorderWorkPackages>[0]) =>
			actual.reorderWorkPackages(updates, testDb),
		clearUnassignedPositions: () => actual.clearUnassignedPositions(testDb)
	};
});

describe('Planning Page Routes', () => {
	beforeEach(() => {
		const testDbInstance = createTestDb();
		testDb = testDbInstance.db;
		testSqlite = testDbInstance.sqlite;
		clearTestDb(testDb);
	});

	afterAll(() => {
		if (testSqlite) {
			closeTestDb(testSqlite);
		}
	});

	describe('load function', () => {
		it('should return initialState with teams and workPackages arrays matching PlanningPageData type', async () => {
			const result = await load({} as Parameters<typeof load>[0]);

			// Verify the result has the correct shape for PlanningPageData
			expect(result).toBeDefined();
			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}
			expect(result).toHaveProperty('initialState');
			expect(result.initialState).toHaveProperty('teams');
			expect(result.initialState).toHaveProperty('workPackages');
			
			// Verify teams is an array
			expect(Array.isArray(result.initialState.teams)).toBe(true);
			
			// Verify workPackages is an array
			expect(Array.isArray(result.initialState.workPackages)).toBe(true);
		});

		it('should load empty planning view when no data exists', async () => {
			const result = await load({} as Parameters<typeof load>[0]);

			expect(result).toBeDefined();
			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}
			expect(result.initialState.teams).toHaveLength(0);
			expect(result.initialState.workPackages).toHaveLength(0);
		});

		it('should load planning view with teams and work packages', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp = await insertWorkPackage({
				title: 'Test Work Package',
				sizeInPersonMonths: 2.0
			});

			await assignWorkPackage(wp.id, team.id, 0, testDb);

			const result = await load({} as Parameters<typeof load>[0]);

			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}
			expect(result.initialState.teams).toHaveLength(1);
			expect(result.initialState.teams[0].name).toBe('Test Team');
			const assignedWorkPackages = result.initialState.workPackages.filter((w: WorkPackage) => w.assignedTeamId === team.id);
			expect(assignedWorkPackages).toHaveLength(1);
			expect(assignedWorkPackages[0].title).toBe('Test Work Package');
		});

		it('should load planning view with capacity overrides', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			await setCapacityOverride(team.id, '2025-12', 4.5, testDb);

			const result = await load({} as Parameters<typeof load>[0]);

			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}
			expect(result.initialState.teams).toHaveLength(1);
			expect(result.initialState.teams[0].capacityOverrides).toHaveLength(1);
			expect(result.initialState.teams[0].capacityOverrides[0]).toEqual({
				yearMonth: '2025-12',
				capacity: 4.5
			});
		});

		it('should return data matching PlanningPageData structure with all required fields', async () => {
			// Create test data
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			await setCapacityOverride(team.id, '2025-12', 4.5, testDb);

			const wp = await insertWorkPackage({
				title: 'Test Work Package',
				description: 'Test description',
				sizeInPersonMonths: 2.0
			});

			await assignWorkPackage(wp.id, team.id, 0, testDb);

			const result = await load({} as Parameters<typeof load>[0]);

			// Verify structure matches PlanningPageData
			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}
			expect(result).toHaveProperty('initialState');
			
			// Verify team structure
			expect(result.initialState.teams).toHaveLength(1);
			const teamData = result.initialState.teams[0];
			expect(teamData).toHaveProperty('id');
			expect(teamData).toHaveProperty('name');
			expect(teamData).toHaveProperty('monthlyCapacityInPersonMonths');
			expect(teamData).toHaveProperty('capacityOverrides');
			expect(typeof teamData.id).toBe('string');
			expect(typeof teamData.name).toBe('string');
			expect(typeof teamData.monthlyCapacityInPersonMonths).toBe('number');
			expect(Array.isArray(teamData.capacityOverrides)).toBe(true);
			
			// Verify capacity override structure
			expect(teamData.capacityOverrides).toHaveLength(1);
			const override = teamData.capacityOverrides[0];
			expect(override).toHaveProperty('yearMonth');
			expect(override).toHaveProperty('capacity');
			expect(typeof override.yearMonth).toBe('string');
			expect(typeof override.capacity).toBe('number');
			
			// Verify work package structure
			expect(result.initialState.workPackages).toHaveLength(1);
			const wpData = result.initialState.workPackages[0];
			expect(wpData).toHaveProperty('id');
			expect(wpData).toHaveProperty('title');
			expect(wpData).toHaveProperty('description');
			expect(wpData).toHaveProperty('sizeInPersonMonths');
			expect(wpData).toHaveProperty('priority');
			expect(wpData).toHaveProperty('assignedTeamId');
			expect(typeof wpData.id).toBe('string');
			expect(typeof wpData.title).toBe('string');
			expect(typeof wpData.sizeInPersonMonths).toBe('number');
			expect(typeof wpData.priority).toBe('number');
			expect(wpData.assignedTeamId).toBe(team.id);
		});
	});

	describe('updateCapacity action', () => {
		it('should update capacity override successfully', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const formData = new FormData();
			formData.set('teamId', team.id);
			formData.set('yearMonth', '2025-12');
			formData.set('capacity', '4.5');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateCapacity(mockEvent as Parameters<typeof actions.updateCapacity>[0]);

			expect(result).toEqual({ success: true });

			// Verify the capacity was actually updated
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams[0].capacityOverrides).toHaveLength(1);
			expect(view.initialState.teams[0].capacityOverrides[0].capacity).toBe(4.5);
		});

		it('should return error when teamId is missing', async () => {
			const formData = new FormData();
			formData.set('yearMonth', '2025-12');
			formData.set('capacity', '4.5');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateCapacity(mockEvent as Parameters<typeof actions.updateCapacity>[0]);

			expect(result).toHaveProperty('status', 400);
			expect(result).toHaveProperty('data');
			expectErrorMessage(result, 'Missing required fields');
		});

		it('should return error when yearMonth is missing', async () => {
			const formData = new FormData();
			formData.set('teamId', 'team-123');
			formData.set('capacity', '4.5');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateCapacity(mockEvent as Parameters<typeof actions.updateCapacity>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing required fields');
		});

		it('should return error when capacity is invalid', async () => {
			const formData = new FormData();
			formData.set('teamId', 'team-123');
			formData.set('yearMonth', '2025-12');
			formData.set('capacity', 'invalid');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateCapacity(mockEvent as Parameters<typeof actions.updateCapacity>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid capacity value');
		});
	});

	describe('assignWorkPackage action', () => {
		it('should assign work package to team successfully', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp = await insertWorkPackage({
				title: 'Test Work Package',
				sizeInPersonMonths: 2.0
			});

			const formData = new FormData();
			formData.set('workPackageId', wp.id);
			formData.set('teamId', team.id);
			formData.set('position', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.assignWorkPackage(mockEvent as Parameters<typeof actions.assignWorkPackage>[0]);

			expect(result).toEqual({ success: true });

			// Verify the work package was assigned
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			const assignedWorkPackages = view.initialState.workPackages.filter((w: WorkPackage) => w.assignedTeamId === team.id);
			expect(assignedWorkPackages).toHaveLength(1);
			expect(assignedWorkPackages[0].id).toBe(wp.id);
		});

		it('should unassign work package when teamId is empty', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp = await insertWorkPackage({
				title: 'Test Work Package',
				sizeInPersonMonths: 2.0
			});

			await assignWorkPackage(wp.id, team.id, 0, testDb);

			const formData = new FormData();
			formData.set('workPackageId', wp.id);
			formData.set('teamId', '');
			formData.set('position', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.assignWorkPackage(mockEvent as Parameters<typeof actions.assignWorkPackage>[0]);

			expect(result).toEqual({ success: true });

			// Verify the work package was unassigned
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			const assignedWorkPackages = view.initialState.workPackages.filter((w: WorkPackage) => w.assignedTeamId === team.id);
			expect(assignedWorkPackages).toHaveLength(0);
			const unassignedWorkPackages = view.initialState.workPackages.filter((w: WorkPackage) => !w.assignedTeamId);
			expect(unassignedWorkPackages).toHaveLength(1);
		});

		it('should return error when workPackageId is missing', async () => {
			const formData = new FormData();
			formData.set('teamId', 'team-123');
			formData.set('position', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.assignWorkPackage(mockEvent as Parameters<typeof actions.assignWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing work package ID');
		});

		it('should return error when position is invalid', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp = await insertWorkPackage({
				title: 'Test Work Package',
				sizeInPersonMonths: 2.0
			});

			const formData = new FormData();
			formData.set('workPackageId', wp.id);
			formData.set('teamId', team.id);
			formData.set('position', 'invalid');

			const mockEvent = createMockRequest(formData);
			const result = await actions.assignWorkPackage(mockEvent as Parameters<typeof actions.assignWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid position value');
		});

		it('should return error when team does not exist', async () => {
			const wp = await insertWorkPackage({
				title: 'Test Work Package',
				sizeInPersonMonths: 2.0
			});

			const formData = new FormData();
			formData.set('workPackageId', wp.id);
			formData.set('teamId', 'nonexistent-team-id');
			formData.set('position', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.assignWorkPackage(mockEvent as Parameters<typeof actions.assignWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid team assignment');
			// Verify the error details include the team ID
			if (result && typeof result === 'object' && 'data' in result) {
				const data = (result as { data: unknown }).data;
				if (data && typeof data === 'object' && 'details' in data) {
					expect((data as { details: string }).details).toContain('nonexistent-team-id');
				}
			}
		});
	});

	describe('createWorkPackage action', () => {
		it('should create work package successfully', async () => {
			const formData = new FormData();
			const generatedId = crypto.randomUUID();
			formData.set('id', generatedId);
			formData.set('title', 'New Work Package');
			formData.set('description', 'Test description');
			formData.set('sizeInPersonMonths', '2.5');
			formData.set('priority', '1');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('success', true);
			expect(result).toHaveProperty('id', generatedId);

			// Verify the work package was created
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			const unassignedWorkPackages = view.initialState.workPackages.filter((w: WorkPackage) => !w.assignedTeamId);
			expect(unassignedWorkPackages).toHaveLength(1);
			expect(unassignedWorkPackages[0].title).toBe('New Work Package');
			expect(unassignedWorkPackages[0].description).toBe('Test description');
		});

		it('should create work package without description', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('title', 'New Work Package');
			formData.set('sizeInPersonMonths', '2.5');
			formData.set('priority', '1');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('success', true);

			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			const unassignedWorkPackages = view.initialState.workPackages.filter((w: WorkPackage) => !w.assignedTeamId);
			expect(unassignedWorkPackages[0].description).toBeUndefined();
		});

		it('should return error when title is missing', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('sizeInPersonMonths', '2.5');
			formData.set('priority', '1');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing required fields');
		});

		it('should return error when sizeInPersonMonths is invalid', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('title', 'New Work Package');
			formData.set('sizeInPersonMonths', 'invalid');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid size');
		});

		it('should return error when id is missing', async () => {
			const formData = new FormData();
			formData.set('title', 'New Work Package');
			formData.set('sizeInPersonMonths', '2.5');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing work package ID');
		});
	});

	describe('deleteWorkPackage action', () => {
		it('should delete work package successfully', async () => {
			const wp = await insertWorkPackage({
				title: 'Test Work Package',
				sizeInPersonMonths: 2.0
			});

			const formData = new FormData();
			formData.set('id', wp.id);

			const mockEvent = createMockRequest(formData);
			const result = await actions.deleteWorkPackage(mockEvent as Parameters<typeof actions.deleteWorkPackage>[0]);

			expect(result).toEqual({ success: true });

			// Verify the work package was deleted
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.workPackages).toHaveLength(0);
		});

		it('should return error when id is missing', async () => {
			const formData = new FormData();

			const mockEvent = createMockRequest(formData);
			const result = await actions.deleteWorkPackage(mockEvent as Parameters<typeof actions.deleteWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing work package ID');
		});
	});

	describe('createTeam action', () => {
		it('should create team and persist to database', async () => {
			const formData = new FormData();
			const generatedId = crypto.randomUUID();
			formData.set('id', generatedId);
			formData.set('name', 'Engineering Team');
			formData.set('monthlyCapacity', '5.0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('success', true);
			expect(result).toHaveProperty('id', generatedId);

			// Verify the team was persisted to database
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams).toHaveLength(1);
			expect(view.initialState.teams[0].name).toBe('Engineering Team');
			expect(view.initialState.teams[0].monthlyCapacityInPersonMonths).toBe(5.0);
		});

		it('should return error when name is missing', async () => {
			const formData = new FormData();
			formData.set('monthlyCapacity', '5.0');
			formData.set('id', crypto.randomUUID());

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing required fields');
		});

		it('should return error when monthlyCapacity is invalid', async () => {
			const formData = new FormData();
			formData.set('name', 'Engineering Team');
			formData.set('monthlyCapacity', 'invalid');
			formData.set('id', crypto.randomUUID());

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid monthly capacity');
		});

		it('should return error when id is missing', async () => {
			const formData = new FormData();
			formData.set('name', 'Engineering Team');
			formData.set('monthlyCapacity', '5.0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing team ID');
		});
	});

	describe('updateTeam action', () => {
		it('should update team and persist changes to database', async () => {
			const team = await insertTeam({
				name: 'Original Team',
				monthlyCapacity: 3.0
			});

			const formData = new FormData();
			formData.set('id', team.id);
			formData.set('name', 'Updated Team');
			formData.set('monthlyCapacity', '4.5');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateTeam(mockEvent as Parameters<typeof actions.updateTeam>[0]);

			expect(result).toEqual({ success: true });

			// Verify the changes were persisted to database
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams).toHaveLength(1);
			expect(view.initialState.teams[0].name).toBe('Updated Team');
			expect(view.initialState.teams[0].monthlyCapacityInPersonMonths).toBe(4.5);
		});

		it('should update only name when monthlyCapacity is not provided', async () => {
			const team = await insertTeam({
				name: 'Original Team',
				monthlyCapacity: 3.0
			});

			const formData = new FormData();
			formData.set('id', team.id);
			formData.set('name', 'Updated Team');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateTeam(mockEvent as Parameters<typeof actions.updateTeam>[0]);

			expect(result).toEqual({ success: true });

			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams[0].name).toBe('Updated Team');
			expect(view.initialState.teams[0].monthlyCapacityInPersonMonths).toBe(3.0);
		});

		it('should return error when id is missing', async () => {
			const formData = new FormData();
			formData.set('name', 'Updated Team');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateTeam(mockEvent as Parameters<typeof actions.updateTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing team ID');
		});
	});

	describe('deleteTeam action', () => {
		it('should delete team and unassign work packages', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp = await insertWorkPackage({
				title: 'Test Work Package',
				sizeInPersonMonths: 2.0
			});

			await assignWorkPackage(wp.id, team.id, 0, testDb);

			const formData = new FormData();
			formData.set('id', team.id);

			const mockEvent = createMockRequest(formData);
			const result = await actions.deleteTeam(mockEvent as Parameters<typeof actions.deleteTeam>[0]);

			expect(result).toEqual({ success: true });

			// Verify the team was deleted
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams).toHaveLength(0);
			
			// Verify work package was unassigned
			const unassignedWorkPackages = view.initialState.workPackages.filter((w: WorkPackage) => !w.assignedTeamId);
			expect(unassignedWorkPackages).toHaveLength(1);
			expect(unassignedWorkPackages[0].id).toBe(wp.id);
		});

		it('should delete team with capacity overrides', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			await setCapacityOverride(team.id, '2025-12', 4.5, testDb);

			const formData = new FormData();
			formData.set('id', team.id);

			const mockEvent = createMockRequest(formData);
			const result = await actions.deleteTeam(mockEvent as Parameters<typeof actions.deleteTeam>[0]);

			expect(result).toEqual({ success: true });

			// Verify the team and its capacity overrides were deleted
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams).toHaveLength(0);
		});

		it('should return error when id is missing', async () => {
			const formData = new FormData();

			const mockEvent = createMockRequest(formData);
			const result = await actions.deleteTeam(mockEvent as Parameters<typeof actions.deleteTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing team ID');
		});
	});

	describe('updateCapacity action - zero values', () => {
		it('should accept zero as valid capacity value', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const formData = new FormData();
			formData.set('teamId', team.id);
			formData.set('yearMonth', '2025-12');
			formData.set('capacity', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateCapacity(mockEvent as Parameters<typeof actions.updateCapacity>[0]);

			expect(result).toEqual({ success: true });

			// Verify zero capacity was persisted
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams[0].capacityOverrides).toHaveLength(1);
			expect(view.initialState.teams[0].capacityOverrides[0].capacity).toBe(0);
		});

		it('should reject negative capacity values', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const formData = new FormData();
			formData.set('teamId', team.id);
			formData.set('yearMonth', '2025-12');
			formData.set('capacity', '-1');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateCapacity(mockEvent as Parameters<typeof actions.updateCapacity>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid capacity value');
		});
	});

	describe('scheduledPosition preservation', () => {
		it('should preserve scheduledPosition of 0 through load function round-trip', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp = await insertWorkPackage({
				title: 'First Work Package',
				sizeInPersonMonths: 2.0
			});

			// Assign work package to team at position 0 (first position)
			await assignWorkPackage(wp.id, team.id, 0, testDb);

			// Load the data through the load function
			const result = await load({} as Parameters<typeof load>[0]);

			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}

			// Find the work package in the loaded data
			const loadedWorkPackage = result.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			
			expect(loadedWorkPackage).toBeDefined();
			expect(loadedWorkPackage?.scheduledPosition).toBe(0);
			expect(loadedWorkPackage?.assignedTeamId).toBe(team.id);
		});

		it('should preserve scheduledPosition of 0 for unassigned work packages', async () => {
			const wp = await insertWorkPackage({
				title: 'Unassigned Work Package',
				sizeInPersonMonths: 2.0
			});

			// Manually set scheduledPosition to 0 for unassigned work package
			// This simulates a work package that was previously assigned and then unassigned
			const { workPackages } = await import('$lib/server/schema');
			const { eq } = await import('drizzle-orm');
			
			testDb.update(workPackages)
				.set({ scheduledPosition: 0 })
				.where(eq(workPackages.id, wp.id))
				.run();

			// Load the data through the load function
			const result = await load({} as Parameters<typeof load>[0]);

			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}

			// Find the work package in the loaded data
			const loadedWorkPackage = result.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			
			expect(loadedWorkPackage).toBeDefined();
			expect(loadedWorkPackage?.scheduledPosition).toBe(0);
			expect(loadedWorkPackage?.assignedTeamId).toBeUndefined();
		});

		it('should convert null scheduledPosition to undefined', async () => {
			const wp = await insertWorkPackage({
				title: 'Work Package with null position',
				sizeInPersonMonths: 2.0
			});

			// Work packages created without assignment have null scheduledPosition by default

			// Load the data through the load function
			const result = await load({} as Parameters<typeof load>[0]);

			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}

			// Find the work package in the loaded data
			const loadedWorkPackage = result.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			
			expect(loadedWorkPackage).toBeDefined();
			expect(loadedWorkPackage?.scheduledPosition).toBeUndefined();
		});
	});

	describe('priority behavior', () => {
		it('should not change priority when editing work package', async () => {
			const wp = await insertWorkPackage({
				title: 'Original Title',
				sizeInPersonMonths: 2.0
			});

			// Get the original priority
			const loadResult = await load({} as Parameters<typeof load>[0]);
			if (!loadResult || !('initialState' in loadResult)) {
				throw new Error('Expected initialState in result');
			}
			const originalWorkPackage = loadResult.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			const originalPriority = originalWorkPackage?.priority;

			// Update the work package
			const formData = new FormData();
			formData.set('id', wp.id);
			formData.set('title', 'Updated Title');
			formData.set('sizeInPersonMonths', '3.5');

			const mockEvent = createMockRequest(formData);
			await actions.updateWorkPackage(mockEvent as Parameters<typeof actions.updateWorkPackage>[0]);

			// Verify priority hasn't changed
			const updatedResult = await load({} as Parameters<typeof load>[0]);
			if (!updatedResult || !('initialState' in updatedResult)) {
				throw new Error('Expected initialState in result');
			}
			const updatedWorkPackage = updatedResult.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			
			expect(updatedWorkPackage?.priority).toBe(originalPriority);
			expect(updatedWorkPackage?.title).toBe('Updated Title');
			expect(updatedWorkPackage?.sizeInPersonMonths).toBe(3.5);
		});

		it('should assign unique priority when creating work package', async () => {
			// Create first work package
			const formData1 = new FormData();
			formData1.set('id', crypto.randomUUID());
			formData1.set('title', 'First Work Package');
			formData1.set('sizeInPersonMonths', '2.0');

			const mockEvent1 = createMockRequest(formData1);
			await actions.createWorkPackage(mockEvent1 as Parameters<typeof actions.createWorkPackage>[0]);

			// Create second work package
			const formData2 = new FormData();
			formData2.set('id', crypto.randomUUID());
			formData2.set('title', 'Second Work Package');
			formData2.set('sizeInPersonMonths', '3.0');

			const mockEvent2 = createMockRequest(formData2);
			await actions.createWorkPackage(mockEvent2 as Parameters<typeof actions.createWorkPackage>[0]);

			// Verify both have unique priorities
			const result = await load({} as Parameters<typeof load>[0]);
			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}

			expect(result.initialState.workPackages).toHaveLength(2);
			const priorities = result.initialState.workPackages.map((wp: WorkPackage) => wp.priority);
			
			// Check that priorities are unique
			const uniquePriorities = new Set(priorities);
			expect(uniquePriorities.size).toBe(2);
			
			// Check that priorities are sequential
			expect(priorities).toContain(0);
			expect(priorities).toContain(1);
		});

		it('should not reuse priorities after deletions', async () => {
			// Create three work packages
			const formData1 = new FormData();
			const id1 = crypto.randomUUID();
			formData1.set('id', id1);
			formData1.set('title', 'First Work Package');
			formData1.set('sizeInPersonMonths', '2.0');

			const mockEvent1 = createMockRequest(formData1);
			const result1 = await actions.createWorkPackage(mockEvent1 as Parameters<typeof actions.createWorkPackage>[0]);

			const formData2 = new FormData();
			formData2.set('id', crypto.randomUUID());
			formData2.set('title', 'Second Work Package');
			formData2.set('sizeInPersonMonths', '3.0');

			const mockEvent2 = createMockRequest(formData2);
			await actions.createWorkPackage(mockEvent2 as Parameters<typeof actions.createWorkPackage>[0]);

			const formData3 = new FormData();
			formData3.set('id', crypto.randomUUID());
			formData3.set('title', 'Third Work Package');
			formData3.set('sizeInPersonMonths', '1.5');

			const mockEvent3 = createMockRequest(formData3);
			await actions.createWorkPackage(mockEvent3 as Parameters<typeof actions.createWorkPackage>[0]);

			// Delete the first work package
			if (result1 && typeof result1 === 'object' && 'id' in result1) {
				const deleteFormData = new FormData();
				deleteFormData.set('id', result1.id as string);

				const deleteMockEvent = createMockRequest(deleteFormData);
				await actions.deleteWorkPackage(deleteMockEvent as Parameters<typeof actions.deleteWorkPackage>[0]);
			}

			// Create a new work package after deletion
			const formData4 = new FormData();
			formData4.set('id', crypto.randomUUID());
			formData4.set('title', 'Fourth Work Package');
			formData4.set('sizeInPersonMonths', '2.5');

			const mockEvent4 = createMockRequest(formData4);
			await actions.createWorkPackage(mockEvent4 as Parameters<typeof actions.createWorkPackage>[0]);

			// Verify the new work package has priority 3 (not reusing 0)
			const result = await load({} as Parameters<typeof load>[0]);
			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}

			const fourthWorkPackage = result.initialState.workPackages.find((wp: WorkPackage) => wp.title === 'Fourth Work Package');
			expect(fourthWorkPackage?.priority).toBe(3);
		});

		it('should ensure all priority values are unique with no duplicates', async () => {
			// Create multiple work packages
			const titles = ['WP1', 'WP2', 'WP3', 'WP4', 'WP5'];

			for (const title of titles) {
				const formData = new FormData();
				formData.set('id', crypto.randomUUID());
				formData.set('title', title);
				formData.set('sizeInPersonMonths', '2.0');

				const mockEvent = createMockRequest(formData);
				await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);
			}

			// Verify all priorities are unique
			const result = await load({} as Parameters<typeof load>[0]);
			if (!result || !('initialState' in result)) {
				throw new Error('Expected initialState in result');
			}

			expect(result.initialState.workPackages).toHaveLength(5);
			const priorities = result.initialState.workPackages.map((wp: WorkPackage) => wp.priority);

			// Check that all priorities are unique
			const uniquePriorities = new Set(priorities);
			expect(uniquePriorities.size).toBe(5);

			// Check that priorities are sequential starting from 0
			expect(priorities.sort()).toEqual([0, 1, 2, 3, 4]);
		});
	});

	describe('reorderWorkPackages action', () => {
		it('should reorder work packages successfully', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp1 = await insertWorkPackage({ title: 'WP1', sizeInPersonMonths: 1.0 });
			const wp2 = await insertWorkPackage({ title: 'WP2', sizeInPersonMonths: 1.0 });

			await assignWorkPackage(wp1.id, team.id, 0, testDb);
			await assignWorkPackage(wp2.id, team.id, 1, testDb);

			const formData = new FormData();
			formData.set('updates', JSON.stringify([
				{ id: wp1.id, teamId: team.id, position: 1 },
				{ id: wp2.id, teamId: team.id, position: 0 }
			]));

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toEqual({ success: true });

			// Verify the reorder
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			const reorderedWp1 = view.initialState.workPackages.find((w: WorkPackage) => w.id === wp1.id);
			const reorderedWp2 = view.initialState.workPackages.find((w: WorkPackage) => w.id === wp2.id);
			expect(reorderedWp1?.scheduledPosition).toBe(1);
			expect(reorderedWp2?.scheduledPosition).toBe(0);
		});

		it('should return error when updates is missing', async () => {
			const formData = new FormData();

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing updates data');
		});

		it('should return error when updates is invalid JSON', async () => {
			const formData = new FormData();
			formData.set('updates', 'not valid json');

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid updates format');
		});

		it('should return error when updates is not an array', async () => {
			const formData = new FormData();
			formData.set('updates', JSON.stringify({ id: 'test' }));

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid updates array');
		});

		it('should return error when updates is empty array', async () => {
			const formData = new FormData();
			formData.set('updates', JSON.stringify([]));

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid updates array');
		});

		it('should return error when update object has invalid id', async () => {
			const formData = new FormData();
			formData.set('updates', JSON.stringify([{ id: 123, teamId: 'team-1', position: 0 }]));

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid update object');
		});

		it('should return error when update object has invalid teamId', async () => {
			const formData = new FormData();
			formData.set('updates', JSON.stringify([{ id: 'wp-1', teamId: 123, position: 0 }]));

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid update object');
		});

		it('should return error when update object has invalid position', async () => {
			const formData = new FormData();
			formData.set('updates', JSON.stringify([{ id: 'wp-1', teamId: 'team-1', position: -1 }]));

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid update object');
		});

		it('should accept null teamId for unassigning', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp = await insertWorkPackage({ title: 'WP1', sizeInPersonMonths: 1.0 });
			await assignWorkPackage(wp.id, team.id, 0, testDb);

			const formData = new FormData();
			formData.set('updates', JSON.stringify([
				{ id: wp.id, teamId: null, position: 0 }
			]));

			const mockEvent = createMockRequest(formData);
			const result = await actions.reorderWorkPackages(mockEvent as Parameters<typeof actions.reorderWorkPackages>[0]);

			expect(result).toEqual({ success: true });

			// Verify the work package was unassigned
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			const unassignedWp = view.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			expect(unassignedWp?.assignedTeamId).toBeUndefined();
		});
	});

	describe('clearUnassignedPositions action', () => {
		it('should clear scheduled positions for unassigned work packages', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp1 = await insertWorkPackage({ title: 'WP1', sizeInPersonMonths: 1.0 });
			const wp2 = await insertWorkPackage({ title: 'WP2', sizeInPersonMonths: 1.0 });

			// Assign then unassign wp1 to leave a scheduledPosition
			await assignWorkPackage(wp1.id, team.id, 5, testDb);

			// Manually set scheduledPosition for unassigned wp2
			const { workPackages } = await import('$lib/server/schema');
			const { eq } = await import('drizzle-orm');
			testDb.update(workPackages)
				.set({ scheduledPosition: 10, assignedTeamId: null })
				.where(eq(workPackages.id, wp2.id))
				.run();

			// Unassign wp1
			const { unassignWorkPackage } = await import('$lib/server/repositories/work-packages.repository');
			await unassignWorkPackage(wp1.id, testDb);

			// Call clearUnassignedPositions
			const mockEvent = {} as Parameters<typeof actions.clearUnassignedPositions>[0];
			const result = await actions.clearUnassignedPositions(mockEvent);

			expect(result).toEqual({ success: true });

			// Verify positions were cleared for unassigned work packages
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}

			const clearedWp1 = view.initialState.workPackages.find((w: WorkPackage) => w.id === wp1.id);
			const clearedWp2 = view.initialState.workPackages.find((w: WorkPackage) => w.id === wp2.id);

			expect(clearedWp1?.scheduledPosition).toBeUndefined();
			expect(clearedWp2?.scheduledPosition).toBeUndefined();
		});

		it('should not affect assigned work packages', async () => {
			const team = await insertTeam({
				name: 'Test Team',
				monthlyCapacity: 3.0
			});

			const wp = await insertWorkPackage({ title: 'WP1', sizeInPersonMonths: 1.0 });
			await assignWorkPackage(wp.id, team.id, 5, testDb);

			// Call clearUnassignedPositions
			const mockEvent = {} as Parameters<typeof actions.clearUnassignedPositions>[0];
			const result = await actions.clearUnassignedPositions(mockEvent);

			expect(result).toEqual({ success: true });

			// Verify position was NOT cleared for assigned work package
			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}

			const assignedWp = view.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			expect(assignedWp?.scheduledPosition).toBe(5);
			expect(assignedWp?.assignedTeamId).toBe(team.id);
		});
	});

	describe('updateWorkPackage action', () => {
		it('should return error when title is empty', async () => {
			const wp = await insertWorkPackage({ title: 'Test', sizeInPersonMonths: 1.0 });

			const formData = new FormData();
			formData.set('id', wp.id);
			formData.set('title', '   ');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateWorkPackage(mockEvent as Parameters<typeof actions.updateWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid title');
		});

		it('should return error when size is zero', async () => {
			const wp = await insertWorkPackage({ title: 'Test', sizeInPersonMonths: 1.0 });

			const formData = new FormData();
			formData.set('id', wp.id);
			formData.set('sizeInPersonMonths', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateWorkPackage(mockEvent as Parameters<typeof actions.updateWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid size');
		});

		it('should return error when progress is over 100', async () => {
			const wp = await insertWorkPackage({ title: 'Test', sizeInPersonMonths: 1.0 });

			const formData = new FormData();
			formData.set('id', wp.id);
			formData.set('progressPercent', '101');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateWorkPackage(mockEvent as Parameters<typeof actions.updateWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid progress');
		});

		it('should return error when progress is negative', async () => {
			const wp = await insertWorkPackage({ title: 'Test', sizeInPersonMonths: 1.0 });

			const formData = new FormData();
			formData.set('id', wp.id);
			formData.set('progressPercent', '-5');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateWorkPackage(mockEvent as Parameters<typeof actions.updateWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid progress');
		});

		it('should update progress to 100', async () => {
			const wp = await insertWorkPackage({ title: 'Test', sizeInPersonMonths: 1.0 });

			const formData = new FormData();
			formData.set('id', wp.id);
			formData.set('progressPercent', '100');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateWorkPackage(mockEvent as Parameters<typeof actions.updateWorkPackage>[0]);

			expect(result).toEqual({ success: true });

			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			const updatedWp = view.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			expect(updatedWp?.progressPercent).toBe(100);
		});

		it('should clear description when empty string provided', async () => {
			const wp = await insertWorkPackage({
				title: 'Test',
				sizeInPersonMonths: 1.0,
				description: 'Original description'
			});

			const formData = new FormData();
			formData.set('id', wp.id);
			formData.set('description', '');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateWorkPackage(mockEvent as Parameters<typeof actions.updateWorkPackage>[0]);

			expect(result).toEqual({ success: true });

			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			const updatedWp = view.initialState.workPackages.find((w: WorkPackage) => w.id === wp.id);
			expect(updatedWp?.description).toBeUndefined();
		});
	});

	describe('createWorkPackage action - validation', () => {
		it('should return error when title is whitespace only', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('title', '   ');
			formData.set('sizeInPersonMonths', '2.0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid title');
		});

		it('should return error when size is zero', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('title', 'Test');
			formData.set('sizeInPersonMonths', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid size');
		});

		it('should return error when size is negative', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('title', 'Test');
			formData.set('sizeInPersonMonths', '-1');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid size');
		});
	});

	describe('createTeam action - validation', () => {
		it('should return error when name is whitespace only', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('name', '   ');
			formData.set('monthlyCapacity', '5.0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid name');
		});

		it('should allow capacity to be zero', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('name', 'Test Team');
			formData.set('monthlyCapacity', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('success', true);

			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams[0].monthlyCapacityInPersonMonths).toBe(0);
		});

		it('should return error when capacity is negative', async () => {
			const formData = new FormData();
			formData.set('id', crypto.randomUUID());
			formData.set('name', 'Test Team');
			formData.set('monthlyCapacity', '-5');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid monthly capacity');
		});
	});

	describe('updateTeam action - validation', () => {
		it('should return error when name is whitespace only', async () => {
			const team = await insertTeam({ name: 'Original', monthlyCapacity: 3.0 });

			const formData = new FormData();
			formData.set('id', team.id);
			formData.set('name', '   ');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateTeam(mockEvent as Parameters<typeof actions.updateTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid name');
		});

		it('should allow capacity to be zero', async () => {
			const team = await insertTeam({ name: 'Original', monthlyCapacity: 3.0 });

			const formData = new FormData();
			formData.set('id', team.id);
			formData.set('monthlyCapacity', '0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateTeam(mockEvent as Parameters<typeof actions.updateTeam>[0]);

			expect(result).toEqual({ success: true });

			const view = await load({} as Parameters<typeof load>[0]);
			if (!view || !('initialState' in view)) {
				throw new Error('Expected initialState in result');
			}
			expect(view.initialState.teams[0].monthlyCapacityInPersonMonths).toBe(0);
		});

		it('should return error when capacity is negative', async () => {
			const team = await insertTeam({ name: 'Original', monthlyCapacity: 3.0 });

			const formData = new FormData();
			formData.set('id', team.id);
			formData.set('monthlyCapacity', '-5');

			const mockEvent = createMockRequest(formData);
			const result = await actions.updateTeam(mockEvent as Parameters<typeof actions.updateTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid monthly capacity');
		});
	});
});
