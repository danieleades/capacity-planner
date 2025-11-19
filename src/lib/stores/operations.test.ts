import { describe, it, expect, beforeEach } from 'vitest';
import {
	addTeam,
	updateTeam,
	deleteTeam,
	setMonthlyCapacity,
	clearMonthlyCapacity,
	addWorkPackage,
	updateWorkPackage,
	deleteWorkPackage,
	assignWorkPackage,
	reorderWorkPackages
} from './operations';
import type { AppState } from '$lib/types';
import { createMockTeam, createMockWorkPackage } from '../../test/utils/test-data';

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
			expect(result.workPackages[0].assignedTeamId).toBeUndefined();
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

	describe('clearMonthlyCapacity', () => {
		it('should remove capacity override', () => {
			const team = createMockTeam({
				capacityOverrides: [{ yearMonth: '2025-01', capacity: 3.0 }],
			});
			const state = { ...initialState, teams: [team] };
			const result = clearMonthlyCapacity(state, team.id, '2025-01');
			expect(result.teams[0].capacityOverrides).toEqual([]);
		});

		it('should keep other overrides', () => {
			const team = createMockTeam({
				capacityOverrides: [
					{ yearMonth: '2025-01', capacity: 2.0 },
					{ yearMonth: '2025-02', capacity: 3.0 },
				],
			});
			const state = { ...initialState, teams: [team] };
			const result = clearMonthlyCapacity(state, team.id, '2025-01');
			expect(result.teams[0].capacityOverrides).toHaveLength(1);
			expect(result.teams[0].capacityOverrides![0].yearMonth).toBe('2025-02');
		});

		it('should handle clearing non-existent override', () => {
			const team = createMockTeam();
			const state = { ...initialState, teams: [team] };
			const result = clearMonthlyCapacity(state, team.id, '2025-01');
			expect(result.teams[0].capacityOverrides).toEqual([]);
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

	describe('assignWorkPackage', () => {
		it('should assign work package to team', () => {
			const wp = createMockWorkPackage();
			const state = { ...initialState, workPackages: [wp] };
			const result = assignWorkPackage(state, wp.id, 'team-123');
			expect(result.workPackages[0].assignedTeamId).toBe('team-123');
		});

		it('should unassign work package when teamId is undefined', () => {
			const wp = createMockWorkPackage({ assignedTeamId: 'team-123' });
			const state = { ...initialState, workPackages: [wp] };
			const result = assignWorkPackage(state, wp.id, undefined);
			expect(result.workPackages[0].assignedTeamId).toBeUndefined();
		});

		it('should not affect other work packages', () => {
			const wp1 = createMockWorkPackage();
			const wp2 = createMockWorkPackage({ assignedTeamId: 'team-2' });
			const state = { ...initialState, workPackages: [wp1, wp2] };
			const result = assignWorkPackage(state, wp1.id, 'team-1');
			expect(result.workPackages[1].assignedTeamId).toBe('team-2');
		});
	});

	describe('reorderWorkPackages', () => {
		it('should update priorities based on array order', () => {
			const wp1 = createMockWorkPackage({ priority: 0 });
			const wp2 = createMockWorkPackage({ priority: 1 });
			const wp3 = createMockWorkPackage({ priority: 2 });
			const state = { ...initialState, workPackages: [wp1, wp2, wp3] };

			// Reorder: wp3, wp1, wp2
			const result = reorderWorkPackages(state, [wp3, wp1, wp2]);
			expect(result.workPackages[0].priority).toBe(0); // wp3
			expect(result.workPackages[1].priority).toBe(1); // wp1
			expect(result.workPackages[2].priority).toBe(2); // wp2
		});

		it('should handle single item', () => {
			const wp = createMockWorkPackage({ priority: 5 });
			const state = { ...initialState, workPackages: [wp] };
			const result = reorderWorkPackages(state, [wp]);
			expect(result.workPackages[0].priority).toBe(0);
		});

		it('should handle empty array', () => {
			const result = reorderWorkPackages(initialState, []);
			expect(result.workPackages).toHaveLength(0);
		});
	});

});
