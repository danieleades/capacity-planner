import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { createTestDb, clearTestDb, closeTestDb } from '../utils/test-db';
import { load, actions } from '../../routes/+page.server';
import { createTeam, setCapacityOverride } from '$lib/server/repositories/teams.repository';
import { createWorkPackage, assignWorkPackage } from '$lib/server/repositories/work-packages.repository';
import type { RequestEvent } from '@sveltejs/kit';
import type { WorkPackage } from '$lib/types';

// Mock the repository modules to use our test database
let testDb: ReturnType<typeof createTestDb>['db'];
let testSqlite: ReturnType<typeof createTestDb>['sqlite'];

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
		unassignWorkPackage: (workPackageId: string) => actual.unassignWorkPackage(workPackageId, testDb)
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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

			const wp = await createWorkPackage(
				{
					title: 'Test Work Package',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

			await setCapacityOverride(team.id, '2025-12', 4.5, testDb);

			const wp = await createWorkPackage(
				{
					title: 'Test Work Package',
					description: 'Test description',
					sizeInPersonMonths: 2.0,
					priority: 0
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

			const wp = await createWorkPackage(
				{
					title: 'Test Work Package',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

			const wp = await createWorkPackage(
				{
					title: 'Test Work Package',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

			const wp = await createWorkPackage(
				{
					title: 'Test Work Package',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				testDb
			);

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
			const wp = await createWorkPackage(
				{
					title: 'Test Work Package',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				testDb
			);

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
			formData.set('title', 'New Work Package');
			formData.set('description', 'Test description');
			formData.set('sizeInPersonMonths', '2.5');
			formData.set('priority', '1');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('success', true);
			expect(result).toHaveProperty('id');

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
			formData.set('sizeInPersonMonths', '2.5');
			formData.set('priority', '1');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing required fields');
		});

		it('should return error when sizeInPersonMonths is invalid', async () => {
			const formData = new FormData();
			formData.set('title', 'New Work Package');
			formData.set('sizeInPersonMonths', 'invalid');
			formData.set('priority', '1');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid size');
		});

		it('should return error when priority is invalid', async () => {
			const formData = new FormData();
			formData.set('title', 'New Work Package');
			formData.set('sizeInPersonMonths', '2.5');
			formData.set('priority', 'invalid');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createWorkPackage(mockEvent as Parameters<typeof actions.createWorkPackage>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid priority');
		});
	});

	describe('deleteWorkPackage action', () => {
		it('should delete work package successfully', async () => {
			const wp = await createWorkPackage(
				{
					title: 'Test Work Package',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				testDb
			);

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
			formData.set('name', 'Engineering Team');
			formData.set('monthlyCapacity', '5.0');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('success', true);
			expect(result).toHaveProperty('id');

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

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Missing required fields');
		});

		it('should return error when monthlyCapacity is invalid', async () => {
			const formData = new FormData();
			formData.set('name', 'Engineering Team');
			formData.set('monthlyCapacity', 'invalid');

			const mockEvent = createMockRequest(formData);
			const result = await actions.createTeam(mockEvent as Parameters<typeof actions.createTeam>[0]);

			expect(result).toHaveProperty('status', 400);
			expectErrorMessage(result, 'Invalid monthly capacity');
		});
	});

	describe('updateTeam action', () => {
		it('should update team and persist changes to database', async () => {
			const team = await createTeam(
				{
					name: 'Original Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Original Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

			const wp = await createWorkPackage(
				{
					title: 'Test Work Package',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

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
			const team = await createTeam(
				{
					name: 'Test Team',
					monthlyCapacity: 3.0
				},
				testDb
			);

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
});
