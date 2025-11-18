import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, clearTestDb, closeTestDb } from '../../../test/utils/test-db';
import { getPlanningView } from './planning.repository';
import { createTeam, setCapacityOverride } from './teams.repository';
import { createWorkPackage, assignWorkPackage } from './work-packages.repository';

describe('planning repository', () => {
	const { db, sqlite } = createTestDb();

	beforeEach(() => {
		clearTestDb(db);
	});

	afterAll(() => {
		closeTestDb(sqlite);
	});

	describe('getPlanningView', () => {
		it('should return empty view when no data exists', () => {
			const view = getPlanningView(db);

			expect(view.teams).toHaveLength(0);
			expect(view.unassignedWorkPackages).toHaveLength(0);
		});

		it('should return teams with no work packages', async () => {
			await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			await createTeam(
				{
					name: 'Team B',
					monthlyCapacity: 2.5
				},
				db
			);

			const view = getPlanningView(db);

			expect(view.teams).toHaveLength(2);
			expect(view.teams[0].name).toBe('Team A');
			expect(view.teams[0].monthlyCapacity).toBe(3.0);
			expect(view.teams[0].workPackages).toHaveLength(0);
			expect(view.teams[0].capacityOverrides).toHaveLength(0);
			expect(view.teams[1].name).toBe('Team B');
		});

		it('should include capacity overrides for teams', async () => {
			const team = await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			await setCapacityOverride(team.id, '2025-01', 4.0, db);
			await setCapacityOverride(team.id, '2025-02', 2.0, db);

			const view = getPlanningView(db);

			expect(view.teams).toHaveLength(1);
			expect(view.teams[0].capacityOverrides).toHaveLength(2);
			expect(view.teams[0].capacityOverrides).toContainEqual({
				yearMonth: '2025-01',
				capacity: 4.0
			});
			expect(view.teams[0].capacityOverrides).toContainEqual({
				yearMonth: '2025-02',
				capacity: 2.0
			});
		});

		it('should return unassigned work packages sorted by priority', async () => {
			await createWorkPackage(
				{
					title: 'Feature C',
					sizeInPersonMonths: 1.0,
					priority: 3
				},
				db
			);

			await createWorkPackage(
				{
					title: 'Feature A',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			await createWorkPackage(
				{
					title: 'Feature B',
					sizeInPersonMonths: 1.5,
					priority: 2
				},
				db
			);

			const view = getPlanningView(db);

			expect(view.unassignedWorkPackages).toHaveLength(3);
			expect(view.unassignedWorkPackages[0].title).toBe('Feature A');
			expect(view.unassignedWorkPackages[0].priority).toBe(1);
			expect(view.unassignedWorkPackages[1].title).toBe('Feature B');
			expect(view.unassignedWorkPackages[2].title).toBe('Feature C');
		});

		it('should assign work packages to correct teams', async () => {
			const teamA = await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			const teamB = await createTeam(
				{
					name: 'Team B',
					monthlyCapacity: 2.0
				},
				db
			);

			const wp1 = await createWorkPackage(
				{
					title: 'Feature 1',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			const wp2 = await createWorkPackage(
				{
					title: 'Feature 2',
					sizeInPersonMonths: 1.5,
					priority: 2
				},
				db
			);

			await assignWorkPackage(wp1.id, teamA.id, 0, db);
			await assignWorkPackage(wp2.id, teamB.id, 0, db);

			const view = getPlanningView(db);

			expect(view.teams[0].workPackages).toHaveLength(1);
			expect(view.teams[0].workPackages[0].title).toBe('Feature 1');
			expect(view.teams[1].workPackages).toHaveLength(1);
			expect(view.teams[1].workPackages[0].title).toBe('Feature 2');
			expect(view.unassignedWorkPackages).toHaveLength(0);
		});

		it('should sort work packages by scheduled position within teams', async () => {
			const team = await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			const wp1 = await createWorkPackage(
				{
					title: 'Feature 1',
					sizeInPersonMonths: 1.0,
					priority: 1
				},
				db
			);

			const wp2 = await createWorkPackage(
				{
					title: 'Feature 2',
					sizeInPersonMonths: 1.0,
					priority: 2
				},
				db
			);

			const wp3 = await createWorkPackage(
				{
					title: 'Feature 3',
					sizeInPersonMonths: 1.0,
					priority: 3
				},
				db
			);

			// Assign in non-sequential order
			await assignWorkPackage(wp2.id, team.id, 1, db);
			await assignWorkPackage(wp3.id, team.id, 2, db);
			await assignWorkPackage(wp1.id, team.id, 0, db);

			const view = getPlanningView(db);

			expect(view.teams[0].workPackages).toHaveLength(3);
			expect(view.teams[0].workPackages[0].title).toBe('Feature 1');
			expect(view.teams[0].workPackages[0].scheduledPosition).toBe(0);
			expect(view.teams[0].workPackages[1].title).toBe('Feature 2');
			expect(view.teams[0].workPackages[1].scheduledPosition).toBe(1);
			expect(view.teams[0].workPackages[2].title).toBe('Feature 3');
			expect(view.teams[0].workPackages[2].scheduledPosition).toBe(2);
		});

		it('should handle work packages with null scheduled position', async () => {
			const team = await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			const wp1 = await createWorkPackage(
				{
					title: 'Feature 1',
					sizeInPersonMonths: 1.0,
					priority: 1
				},
				db
			);

			const wp2 = await createWorkPackage(
				{
					title: 'Feature 2',
					sizeInPersonMonths: 1.0,
					priority: 2
				},
				db
			);

			await assignWorkPackage(wp1.id, team.id, 0, db);
			await assignWorkPackage(wp2.id, team.id, 1, db);

			const view = getPlanningView(db);

			expect(view.teams[0].workPackages).toHaveLength(2);
			expect(view.teams[0].workPackages[0].scheduledPosition).toBe(0);
			expect(view.teams[0].workPackages[1].scheduledPosition).toBe(1);
		});

		it('should return complete planning view with all data', async () => {
			const teamA = await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			const teamB = await createTeam(
				{
					name: 'Team B',
					monthlyCapacity: 2.5
				},
				db
			);

			await setCapacityOverride(teamA.id, '2025-01', 4.0, db);

			const wp1 = await createWorkPackage(
				{
					title: 'Assigned to A',
					description: 'Work for team A',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			const wp2 = await createWorkPackage(
				{
					title: 'Assigned to B',
					sizeInPersonMonths: 1.5,
					priority: 2
				},
				db
			);

			await createWorkPackage(
				{
					title: 'Unassigned',
					sizeInPersonMonths: 1.0,
					priority: 3
				},
				db
			);

			await assignWorkPackage(wp1.id, teamA.id, 0, db);
			await assignWorkPackage(wp2.id, teamB.id, 0, db);

			const view = getPlanningView(db);

			expect(view.teams).toHaveLength(2);
			expect(view.teams[0].name).toBe('Team A');
			expect(view.teams[0].capacityOverrides).toHaveLength(1);
			expect(view.teams[0].workPackages).toHaveLength(1);
			expect(view.teams[0].workPackages[0].title).toBe('Assigned to A');
			expect(view.teams[0].workPackages[0].description).toBe('Work for team A');

			expect(view.teams[1].name).toBe('Team B');
			expect(view.teams[1].capacityOverrides).toHaveLength(0);
			expect(view.teams[1].workPackages).toHaveLength(1);
			expect(view.teams[1].workPackages[0].title).toBe('Assigned to B');

			expect(view.unassignedWorkPackages).toHaveLength(1);
			expect(view.unassignedWorkPackages[0].title).toBe('Unassigned');
		});
	});
});
