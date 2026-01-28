import { describe, it, expect, beforeEach } from 'vitest';
import {
	addTeam,
	updateTeam,
	deleteTeam,
	setMonthlyCapacity,
	addWorkPackage,
	updateWorkPackage,
	deleteWorkPackage,
	batchUpdateWorkPackages,
	clearUnassignedScheduledPositions
} from './operations';
import type { AppState } from '$lib/types';
import { createMockTeam, createMockWorkPackage, testTeamId, testWorkPackageId } from '../../test/utils/test-data';

describe('store operations', () => {
	let initialState: AppState;

	beforeEach(() => {
		initialState = {
			teams: [],
			workPackages: [],
		};
	});

	describe('addTeam', () => {
		it('should add a new team to empty state', () => {
			const result = addTeam(initialState, 'Platform Team', 2.5);
			expect(result.teams).toHaveLength(1);
			expect(result.teams[0].name).toBe('Platform Team');
			expect(result.teams[0].monthlyCapacityInPersonMonths).toBe(2.5);
			expect(result.teams[0].id).toBeDefined();
		});

		it('should add a team to existing teams', () => {
			const state = {
				...initialState,
				teams: [createMockTeam({ name: 'Team 1' })],
			};
			const result = addTeam(state, 'Team 2', 3.0);
			expect(result.teams).toHaveLength(2);
			expect(result.teams[1].name).toBe('Team 2');
		});

		it('should not mutate original state', () => {
			addTeam(initialState, 'Team', 2.0);
			expect(initialState.teams).toHaveLength(0);
		});
	});

	describe('updateTeam', () => {
		it('should update team name', () => {
			const team = createMockTeam({ name: 'Old Name' });
			const state = { ...initialState, teams: [team] };
			const result = updateTeam(state, team.id, { name: 'New Name' });
			expect(result.teams[0].name).toBe('New Name');
		});

		it('should update team capacity', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 2.0 });
			const state = { ...initialState, teams: [team] };
			const result = updateTeam(state, team.id, { monthlyCapacityInPersonMonths: 3.5 });
			expect(result.teams[0].monthlyCapacityInPersonMonths).toBe(3.5);
		});

		it('should not update other teams', () => {
			const team1 = createMockTeam({ name: 'Team 1' });
			const team2 = createMockTeam({ name: 'Team 2' });
			const state = { ...initialState, teams: [team1, team2] };
			const result = updateTeam(state, team1.id, { name: 'Updated' });
			expect(result.teams[1].name).toBe('Team 2');
		});

		it('should not mutate original state', () => {
			const team = createMockTeam({ name: 'Original' });
			const state = { ...initialState, teams: [team] };
			updateTeam(state, team.id, { name: 'Updated' });
			expect(state.teams[0].name).toBe('Original');
		});
	});

	describe('deleteTeam', () => {
		it('should remove team from state', () => {
			const team = createMockTeam();
			const state = { ...initialState, teams: [team] };
			const result = deleteTeam(state, team.id);
			expect(result.teams).toHaveLength(0);
		});

		it('should unassign work packages from deleted team', () => {
			const team = createMockTeam();
			const wp = createMockWorkPackage({ assignedTeamId: team.id });
			const state = { teams: [team], workPackages: [wp] };
			const result = deleteTeam(state, team.id);
			expect(result.workPackages[0].assignedTeamId).toBeNull();
		});

		it('should not affect work packages assigned to other teams', () => {
			const team1 = createMockTeam();
			const team2 = createMockTeam();
			const wp = createMockWorkPackage({ assignedTeamId: team2.id });
			const state = { teams: [team1, team2], workPackages: [wp] };
			const result = deleteTeam(state, team1.id);
			expect(result.workPackages[0].assignedTeamId).toBe(team2.id);
		});
	});

	describe('setMonthlyCapacity', () => {
		it('should add new capacity override', () => {
			const team = createMockTeam();
			const state = { ...initialState, teams: [team] };
			const result = setMonthlyCapacity(state, team.id, '2025-01', 3.0);
			expect(result.teams[0].capacityOverrides).toHaveLength(1);
			expect(result.teams[0].capacityOverrides![0]).toEqual({
				yearMonth: '2025-01',
				capacity: 3.0,
			});
		});

		it('should update existing capacity override', () => {
			const team = createMockTeam({
				capacityOverrides: [{ yearMonth: '2025-01', capacity: 2.0 }],
			});
			const state = { ...initialState, teams: [team] };
			const result = setMonthlyCapacity(state, team.id, '2025-01', 4.0);
			expect(result.teams[0].capacityOverrides).toHaveLength(1);
			expect(result.teams[0].capacityOverrides![0].capacity).toBe(4.0);
		});

		it('should not affect other months', () => {
			const team = createMockTeam({
				capacityOverrides: [
					{ yearMonth: '2025-01', capacity: 2.0 },
					{ yearMonth: '2025-02', capacity: 3.0 },
				],
			});
			const state = { ...initialState, teams: [team] };
			const result = setMonthlyCapacity(state, team.id, '2025-01', 4.0);
			expect(result.teams[0].capacityOverrides![1].capacity).toBe(3.0);
		});

		it('should not affect other teams', () => {
			const team1 = createMockTeam();
			const team2 = createMockTeam();
			const state = { ...initialState, teams: [team1, team2] };
			const result = setMonthlyCapacity(state, team1.id, '2025-01', 3.0);
			expect(result.teams[1].capacityOverrides).toEqual([]);
		});
	});

	describe('addWorkPackage', () => {
		it('should add work package to empty state', () => {
			const result = addWorkPackage(initialState, 'Task 1', 1.5);
			expect(result.workPackages).toHaveLength(1);
			expect(result.workPackages[0].title).toBe('Task 1');
			expect(result.workPackages[0].sizeInPersonMonths).toBe(1.5);
			expect(result.workPackages[0].priority).toBe(0);
		});

		it('should add work package with description', () => {
			const result = addWorkPackage(initialState, 'Task 1', 1.5, 'Description');
			expect(result.workPackages[0].description).toBe('Description');
		});

		it('should assign priority after max existing priority', () => {
			const state = {
				...initialState,
				workPackages: [
					createMockWorkPackage({ priority: 0 }),
					createMockWorkPackage({ priority: 3 }),
					createMockWorkPackage({ priority: 1 }),
				],
			};
			const result = addWorkPackage(state, 'New Task', 1.0);
			expect(result.workPackages[3].priority).toBe(4);
		});
	});

	describe('updateWorkPackage', () => {
		it('should update work package title', () => {
			const wp = createMockWorkPackage({ title: 'Old Title' });
			const state = { ...initialState, workPackages: [wp] };
			const result = updateWorkPackage(state, wp.id, { title: 'New Title' });
			expect(result.workPackages[0].title).toBe('New Title');
		});

		it('should update work package size', () => {
			const wp = createMockWorkPackage({ sizeInPersonMonths: 1.0 });
			const state = { ...initialState, workPackages: [wp] };
			const result = updateWorkPackage(state, wp.id, { sizeInPersonMonths: 2.5 });
			expect(result.workPackages[0].sizeInPersonMonths).toBe(2.5);
		});

		it('should not affect other work packages', () => {
			const wp1 = createMockWorkPackage({ title: 'WP1' });
			const wp2 = createMockWorkPackage({ title: 'WP2' });
			const state = { ...initialState, workPackages: [wp1, wp2] };
			const result = updateWorkPackage(state, wp1.id, { title: 'Updated' });
			expect(result.workPackages[1].title).toBe('WP2');
		});
	});

	describe('deleteWorkPackage', () => {
		it('should remove work package', () => {
			const wp = createMockWorkPackage();
			const state = { ...initialState, workPackages: [wp] };
			const result = deleteWorkPackage(state, wp.id);
			expect(result.workPackages).toHaveLength(0);
		});

		it('should not affect other work packages', () => {
			const wp1 = createMockWorkPackage();
			const wp2 = createMockWorkPackage();
			const state = { ...initialState, workPackages: [wp1, wp2] };
			const result = deleteWorkPackage(state, wp1.id);
			expect(result.workPackages).toHaveLength(1);
			expect(result.workPackages[0].id).toBe(wp2.id);
		});
	});

	describe('batchUpdateWorkPackages', () => {
		it('should update multiple work packages atomically', () => {
			const wpId1 = testWorkPackageId('wp1');
			const wpId2 = testWorkPackageId('wp2');
			const wpId3 = testWorkPackageId('wp3');
			const teamId = testTeamId('team-1');
			const wp1 = createMockWorkPackage({ id: wpId1 });
			const wp2 = createMockWorkPackage({ id: wpId2 });
			const wp3 = createMockWorkPackage({ id: wpId3 });
			const state = { ...initialState, workPackages: [wp1, wp2, wp3] };

			const result = batchUpdateWorkPackages(state, [
				{ id: wpId1, teamId: teamId, position: 0 },
				{ id: wpId3, teamId: teamId, position: 1 }
			]);

			expect(result.workPackages[0].assignedTeamId).toBe(teamId);
			expect(result.workPackages[0].scheduledPosition).toBe(0);
			expect(result.workPackages[1].assignedTeamId).toBeNull();
			expect(result.workPackages[2].assignedTeamId).toBe(teamId);
			expect(result.workPackages[2].scheduledPosition).toBe(1);
		});

		it('should handle null teamId (unassign)', () => {
			const teamId = testTeamId('team-1');
			const wp = createMockWorkPackage({ assignedTeamId: teamId });
			const state = { ...initialState, workPackages: [wp] };

			const result = batchUpdateWorkPackages(state, [
				{ id: wp.id, teamId: null, position: 0 }
			]);

			expect(result.workPackages[0].assignedTeamId).toBeNull();
		});

		it('should not mutate original state', () => {
			const teamId = testTeamId('team-1');
			const wp = createMockWorkPackage();
			const state = { ...initialState, workPackages: [wp] };
			const originalTeamId = wp.assignedTeamId;

			batchUpdateWorkPackages(state, [{ id: wp.id, teamId: teamId, position: 0 }]);

			expect(state.workPackages[0].assignedTeamId).toBe(originalTeamId);
		});
	});

	describe('clearUnassignedScheduledPositions', () => {
		it('should clear scheduledPosition for unassigned work packages', () => {
			const wp1 = createMockWorkPackage({ assignedTeamId: null, scheduledPosition: 5 });
			const wp2 = createMockWorkPackage({ assignedTeamId: null, scheduledPosition: 10 });
			const state = { ...initialState, workPackages: [wp1, wp2] };

			const result = clearUnassignedScheduledPositions(state);

			expect(result.workPackages[0].scheduledPosition).toBeNull();
			expect(result.workPackages[1].scheduledPosition).toBeNull();
		});

		it('should not affect assigned work packages', () => {
			const teamId = testTeamId('team-1');
			const wp1 = createMockWorkPackage({ assignedTeamId: teamId, scheduledPosition: 5 });
			const wp2 = createMockWorkPackage({ assignedTeamId: null, scheduledPosition: 10 });
			const state = { ...initialState, workPackages: [wp1, wp2] };

			const result = clearUnassignedScheduledPositions(state);

			expect(result.workPackages[0].scheduledPosition).toBe(5);
			expect(result.workPackages[1].scheduledPosition).toBeNull();
		});

		it('should not mutate original state', () => {
			const wp = createMockWorkPackage({ assignedTeamId: null, scheduledPosition: 5 });
			const state = { ...initialState, workPackages: [wp] };

			clearUnassignedScheduledPositions(state);

			expect(state.workPackages[0].scheduledPosition).toBe(5);
		});
	});

	describe('deleteTeam - enhanced', () => {
		it('should clear scheduledPosition when unassigning work packages', () => {
			const team = createMockTeam();
			const wp = createMockWorkPackage({ assignedTeamId: team.id, scheduledPosition: 3 });
			const state = { ...initialState, teams: [team], workPackages: [wp] };

			const result = deleteTeam(state, team.id);

			expect(result.workPackages[0].assignedTeamId).toBeNull();
			expect(result.workPackages[0].scheduledPosition).toBeNull();
		});
	});

	describe('setMonthlyCapacity - enhanced', () => {
		it('should auto-remove override when capacity matches default', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 5.0 });
			const state = {
				...initialState,
				teams: [{ ...team, capacityOverrides: [{ yearMonth: '2025-01', capacity: 3.0 }] }]
			};

			// Set capacity to match default
			const result = setMonthlyCapacity(state, team.id, '2025-01', 5.0);

			expect(result.teams[0].capacityOverrides).toHaveLength(0);
		});

		it('should add override when capacity differs from default', () => {
			const team = createMockTeam({ monthlyCapacityInPersonMonths: 5.0 });
			const state = { ...initialState, teams: [team] };

			const result = setMonthlyCapacity(state, team.id, '2025-01', 3.0);

			expect(result.teams[0].capacityOverrides).toHaveLength(1);
			expect(result.teams[0].capacityOverrides[0].capacity).toBe(3.0);
		});
	});

});
