import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, clearTestDb, closeTestDb } from '../../../test/utils/test-db';
import {
	createWorkPackage,
	updateWorkPackage,
	deleteWorkPackage,
	assignWorkPackage,
	unassignWorkPackage,
	clearUnassignedPositions
} from './work-packages.repository';
import type { CreateWorkPackageInput } from './work-packages.repository';
import { createTeam } from './teams.repository';
import type { CreateTeamInput } from './teams.repository';
import { workPackages } from '../schema';
import { eq } from 'drizzle-orm';

describe('work packages repository', () => {
	const { db, sqlite } = createTestDb();

	const buildWorkPackageInput = (
		overrides: Partial<CreateWorkPackageInput> = {}
	): CreateWorkPackageInput => ({
		id: crypto.randomUUID(),
		title: 'Test Work Package',
		sizeInPersonMonths: 1,
		...overrides
	});

	const buildTeamInput = (overrides: Partial<CreateTeamInput> = {}): CreateTeamInput => ({
		id: crypto.randomUUID(),
		name: 'Test Team',
		monthlyCapacity: 1,
		...overrides
	});

	beforeEach(() => {
		clearTestDb(db);
	});

	afterAll(() => {
		closeTestDb(sqlite);
	});

	describe('createWorkPackage', () => {
		it('should create a work package with generated ID and timestamps', async () => {
			const result = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature A',
					description: 'Build feature A',
					sizeInPersonMonths: 2.5
				}),
				db
			);

			expect(result.id).toBeDefined();
			expect(typeof result.id).toBe('string');

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.title).toBe('Feature A');
			expect(wp.description).toBe('Build feature A');
			expect(wp.sizeInPersonMonths).toBe(2.5);
			// Priority is auto-assigned starting from 0 for the first work package
			expect(wp.priority).toBe(0);
			expect(wp.assignedTeamId).toBeNull();
			expect(wp.scheduledPosition).toBeNull();
			expect(wp.createdAt).toBeInstanceOf(Date);
			expect(wp.updatedAt).toBeInstanceOf(Date);
		});

		it('should create work package without description', async () => {
			await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature B',
					sizeInPersonMonths: 1.0
				}),
				db
			);

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.description).toBeNull();
		});

		it('should throw error for invalid work package data', async () => {
			await expect(
				createWorkPackage(
					buildWorkPackageInput({
						title: '',
						sizeInPersonMonths: 2.0
					}),
					db
				)
			).rejects.toThrow();
		});

		it('should throw error for negative size', async () => {
			await expect(
				createWorkPackage(
					buildWorkPackageInput({
						title: 'Feature',
						sizeInPersonMonths: -1
					}),
					db
				)
			).rejects.toThrow();
		});
	});

	describe('updateWorkPackage', () => {
		it('should update work package title', async () => {
			const { id } = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Old Title',
					sizeInPersonMonths: 2.0
				}),
				db
			);

			await updateWorkPackage(id, { title: 'New Title' }, db);

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.title).toBe('New Title');
		});

		it('should update work package size', async () => {
			const { id } = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
				db
			);

			await updateWorkPackage(id, { sizeInPersonMonths: 3.5 }, db);

			const wp = db.select().from(workPackages).all()[0];
			expect(wp.sizeInPersonMonths).toBe(3.5);
		});

		it('should update updatedAt timestamp', async () => {
			const { id } = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
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
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
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
				buildWorkPackageInput({
					title: 'To Delete',
					sizeInPersonMonths: 1.0
				}),
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
				buildTeamInput({
					name: 'Team A',
					monthlyCapacity: 3.0
				}),
				db
			);

			const wp = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
				db
			);

			await assignWorkPackage(wp.id, team.id, 0, db);

			const assigned = db.select().from(workPackages).all()[0];
			expect(assigned.assignedTeamId).toBe(team.id);
			expect(assigned.scheduledPosition).toBe(0);
		});

		it('should update assignment if already assigned', async () => {
			const team1 = await createTeam(
				buildTeamInput({
					name: 'Team A',
					monthlyCapacity: 3.0
				}),
				db
			);

			const team2 = await createTeam(
				buildTeamInput({
					name: 'Team B',
					monthlyCapacity: 2.0
				}),
				db
			);

			const wp = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
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
				buildTeamInput({
					name: 'Team A',
					monthlyCapacity: 3.0
				}),
				db
			);

			const wp = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
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
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
				db
			);

			await expect(unassignWorkPackage(wp.id, db)).resolves.not.toThrow();

			const result = db.select().from(workPackages).all()[0];
			expect(result.assignedTeamId).toBeNull();
		});
	});

	describe('clearUnassignedPositions', () => {
		it('should clear scheduledPosition for unassigned work packages', async () => {
			const wp = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
				db
			);

			// Manually set a scheduled position
			db.update(workPackages)
				.set({ scheduledPosition: 5 })
				.where(eq(workPackages.id, wp.id))
				.run();

			await clearUnassignedPositions(db);

			const result = db.select().from(workPackages).all()[0];
			expect(result.scheduledPosition).toBeNull();
		});

		it('should not affect assigned work packages', async () => {
			const team = await createTeam(
				buildTeamInput({
					name: 'Team A',
					monthlyCapacity: 3.0
				}),
				db
			);

			const wp = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
				db
			);

			await assignWorkPackage(wp.id, team.id, 3, db);

			await clearUnassignedPositions(db);

			const result = db.select().from(workPackages).all()[0];
			expect(result.scheduledPosition).toBe(3);
		});

		it('should update timestamp when clearing positions', async () => {
			const wp = await createWorkPackage(
				buildWorkPackageInput({
					title: 'Feature',
					sizeInPersonMonths: 2.0
				}),
				db
			);

			// Manually set a scheduled position with an explicit old timestamp
			const oldTimestamp = new Date('2020-01-01T00:00:00.000Z');
			db.update(workPackages)
				.set({ scheduledPosition: 5, updatedAt: oldTimestamp })
				.where(eq(workPackages.id, wp.id))
				.run();

			const beforeClear = db.select().from(workPackages).all()[0];
			expect(beforeClear.updatedAt).toEqual(oldTimestamp);

			await clearUnassignedPositions(db);

			const afterClear = db.select().from(workPackages).all()[0];
			const afterTimestamp = afterClear.updatedAt;

			// Timestamp should be updated to current time (much later than 2020)
			expect(afterTimestamp).not.toEqual(oldTimestamp);
			expect(afterTimestamp.getTime()).toBeGreaterThan(oldTimestamp.getTime());
			// Verify it's been updated to a recent time (within last minute)
			const now = new Date();
			const timeDiffMs = now.getTime() - afterTimestamp.getTime();
			expect(timeDiffMs).toBeLessThan(60000); // Less than 1 minute ago
		});
	});
});
