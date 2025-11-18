import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, clearTestDb, closeTestDb } from '../../../test/utils/test-db';
import {
	createWorkPackage,
	updateWorkPackage,
	deleteWorkPackage,
	assignWorkPackage,
	unassignWorkPackage
} from './work-packages.repository';
import { createTeam } from './teams.repository';
import { workPackages } from '../schema';

describe('work packages repository', () => {
	const { db, sqlite } = createTestDb();

	beforeEach(() => {
		clearTestDb(db);
	});

	afterAll(() => {
		closeTestDb(sqlite);
	});

	describe('createWorkPackage', () => {
		it('should create a work package with generated ID and timestamps', async () => {
			const result = await createWorkPackage(
				{
					title: 'Feature A',
					description: 'Build feature A',
					sizeInPersonMonths: 2.5,
					priority: 1
				},
				db
			);

			expect(result.id).toBeDefined();
			expect(typeof result.id).toBe('string');

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.title).toBe('Feature A');
			expect(wp.description).toBe('Build feature A');
			expect(wp.sizeInPersonMonths).toBe(2.5);
			expect(wp.priority).toBe(1);
			expect(wp.assignedTeamId).toBeNull();
			expect(wp.scheduledPosition).toBeNull();
			expect(wp.createdAt).toBeInstanceOf(Date);
			expect(wp.updatedAt).toBeInstanceOf(Date);
		});

		it('should create work package without description', async () => {
			await createWorkPackage(
				{
					title: 'Feature B',
					sizeInPersonMonths: 1.0,
					priority: 2
				},
				db
			);

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.description).toBeNull();
		});

		it('should throw error for invalid work package data', async () => {
			await expect(
				createWorkPackage(
					{
						title: '',
						sizeInPersonMonths: 2.0,
						priority: 1
					},
					db
				)
			).rejects.toThrow();
		});

		it('should throw error for negative size', async () => {
			await expect(
				createWorkPackage(
					{
						title: 'Feature',
						sizeInPersonMonths: -1,
						priority: 1
					},
					db
				)
			).rejects.toThrow();
		});
	});

	describe('updateWorkPackage', () => {
		it('should update work package title', async () => {
			const { id } = await createWorkPackage(
				{
					title: 'Old Title',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			await updateWorkPackage(id, { title: 'New Title' }, db);

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.title).toBe('New Title');
		});

		it('should update work package size', async () => {
			const { id } = await createWorkPackage(
				{
					title: 'Feature',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			await updateWorkPackage(id, { sizeInPersonMonths: 3.5 }, db);

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.sizeInPersonMonths).toBe(3.5);
		});

		it('should update updatedAt timestamp', async () => {
			const { id } = await createWorkPackage(
				{
					title: 'Feature',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			const original = db.select().from(workPackages).all()[0];
			const originalUpdatedAt = original.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 50));

			await updateWorkPackage(id, { title: 'Updated' }, db);

			const updated = db.select().from(workPackages).all()[0];
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
		});

		it('should handle empty update gracefully', async () => {
			const { id } = await createWorkPackage(
				{
					title: 'Feature',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			await updateWorkPackage(id, {}, db);

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.title).toBe('Feature');
		});
	});

	describe('deleteWorkPackage', () => {
		it('should delete a work package', async () => {
			const { id } = await createWorkPackage(
				{
					title: 'To Delete',
					sizeInPersonMonths: 1.0,
					priority: 1
				},
				db
			);

			await deleteWorkPackage(id, db);

			const all = db.select().from(workPackages).all();
			expect(all).toHaveLength(0);
		});
	});

	describe('assignWorkPackage', () => {
		it('should assign work package to team with position', async () => {
			const team = await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			const wp = await createWorkPackage(
				{
					title: 'Feature',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			await assignWorkPackage(wp.id, team.id, 0, db);

			const assigned = db.select().from(workPackages).all()[0];
			expect(assigned.assignedTeamId).toBe(team.id);
			expect(assigned.scheduledPosition).toBe(0);
		});

		it('should update assignment if already assigned', async () => {
			const team1 = await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			const team2 = await createTeam(
				{
					name: 'Team B',
					monthlyCapacity: 2.0
				},
				db
			);

			const wp = await createWorkPackage(
				{
					title: 'Feature',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			await assignWorkPackage(wp.id, team1.id, 0, db);
			await assignWorkPackage(wp.id, team2.id, 1, db);

			const assigned = db.select().from(workPackages).all()[0];
			expect(assigned.assignedTeamId).toBe(team2.id);
			expect(assigned.scheduledPosition).toBe(1);
		});
	});

	describe('unassignWorkPackage', () => {
		it('should unassign work package from team', async () => {
			const team = await createTeam(
				{
					name: 'Team A',
					monthlyCapacity: 3.0
				},
				db
			);

			const wp = await createWorkPackage(
				{
					title: 'Feature',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			await assignWorkPackage(wp.id, team.id, 0, db);
			await unassignWorkPackage(wp.id, db);

			const unassigned = db.select().from(workPackages).all()[0];
			expect(unassigned.assignedTeamId).toBeNull();
			expect(unassigned.scheduledPosition).toBeNull();
		});

		it('should handle unassigning already unassigned work package', async () => {
			const wp = await createWorkPackage(
				{
					title: 'Feature',
					sizeInPersonMonths: 2.0,
					priority: 1
				},
				db
			);

			await expect(unassignWorkPackage(wp.id, db)).resolves.not.toThrow();

			const result = db.select().from(workPackages).all()[0];
			expect(result.assignedTeamId).toBeNull();
		});
	});
});
