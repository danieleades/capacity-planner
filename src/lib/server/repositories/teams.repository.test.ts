import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, clearTestDb, closeTestDb } from '../../../test/utils/test-db';
import {
	createTeam,
	updateTeam,
	deleteTeam,
	setCapacityOverride,
	removeCapacityOverride
} from './teams.repository';
import { teams, capacityOverrides } from '../schema';

describe('teams repository', () => {
	const { db, sqlite } = createTestDb();

	beforeEach(() => {
		clearTestDb(db);
	});

	afterAll(() => {
		closeTestDb(sqlite);
	});

	describe('createTeam', () => {
		it('should create a team with generated ID and timestamps', async () => {
			const result = await createTeam(
				{
					name: 'Engineering Team',
					monthlyCapacity: 5.0
				},
				db
			);

			expect(result.id).toBeDefined();
			expect(typeof result.id).toBe('string');

			const team = db.select().from(teams).all()[0];
			expect(team.name).toBe('Engineering Team');
			expect(team.monthlyCapacity).toBe(5.0);
			expect(team.createdAt).toBeInstanceOf(Date);
			expect(team.updatedAt).toBeInstanceOf(Date);
		});

		it('should throw error for invalid team data', async () => {
			await expect(
				createTeam(
					{
						name: '',
						monthlyCapacity: 5.0
					},
					db
				)
			).rejects.toThrow();
		});

		it('should throw error for negative capacity', async () => {
			await expect(
				createTeam(
					{
						name: 'Team',
						monthlyCapacity: -1
					},
					db
				)
			).rejects.toThrow();
		});
	});

	describe('updateTeam', () => {
		it('should update team name', async () => {
			const { id } = await createTeam(
				{
					name: 'Old Name',
					monthlyCapacity: 3.0
				},
				db
			);

			await updateTeam(id, { name: 'New Name' }, db);

			const team = db.select().from(teams).all()[0];
			expect(team.name).toBe('New Name');
			expect(team.monthlyCapacity).toBe(3.0);
		});

		it('should update team capacity', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 3.0
				},
				db
			);

			await updateTeam(id, { monthlyCapacity: 5.5 }, db);

			const team = db.select().from(teams).all()[0];
			expect(team.monthlyCapacity).toBe(5.5);
		});

		it('should update updatedAt timestamp', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 3.0
				},
				db
			);

			const originalTeam = db.select().from(teams).all()[0];
			const originalUpdatedAt = originalTeam.updatedAt;

			// Wait to ensure timestamp difference
			await new Promise((resolve) => setTimeout(resolve, 50));

			await updateTeam(id, { name: 'Updated' }, db);

			const updatedTeam = db.select().from(teams).all()[0];
			expect(updatedTeam.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
		});

		it('should handle empty update gracefully', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 3.0
				},
				db
			);

			await updateTeam(id, {}, db);

			const team = db.select().from(teams).all()[0];
			expect(team.name).toBe('Team');
		});
	});

	describe('deleteTeam', () => {
		it('should delete a team', async () => {
			const { id } = await createTeam(
				{
					name: 'Team to Delete',
					monthlyCapacity: 2.0
				},
				db
			);

			await deleteTeam(id, db);

			const allTeams = db.select().from(teams).all();
			expect(allTeams).toHaveLength(0);
		});

		it('should cascade delete capacity overrides', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await setCapacityOverride(id, '2025-01', 3.0, db);

			await deleteTeam(id, db);

			const allOverrides = db.select().from(capacityOverrides).all();
			expect(allOverrides).toHaveLength(0);
		});
	});

	describe('setCapacityOverride', () => {
		it('should create a new capacity override', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await setCapacityOverride(id, '2025-01', 3.5, db);

			const overrides = db.select().from(capacityOverrides).all();
			expect(overrides).toHaveLength(1);
			expect(overrides[0].teamId).toBe(id);
			expect(overrides[0].yearMonth).toBe('2025-01');
			expect(overrides[0].capacity).toBe(3.5);
		});

		it('should update existing capacity override', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await setCapacityOverride(id, '2025-01', 3.0, db);
			await setCapacityOverride(id, '2025-01', 4.0, db);

			const overrides = db.select().from(capacityOverrides).all();
			expect(overrides).toHaveLength(1);
			expect(overrides[0].capacity).toBe(4.0);
		});

		it('should allow multiple overrides for different months', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await setCapacityOverride(id, '2025-01', 3.0, db);
			await setCapacityOverride(id, '2025-02', 4.0, db);

			const overrides = db.select().from(capacityOverrides).all();
			expect(overrides).toHaveLength(2);
		});

		it('should throw error for invalid yearMonth format', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await expect(setCapacityOverride(id, 'invalid', 3.0, db)).rejects.toThrow();
		});

		it('should throw error for negative capacity', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await expect(setCapacityOverride(id, '2025-01', -1, db)).rejects.toThrow();
		});
	});

	describe('removeCapacityOverride', () => {
		it('should remove a capacity override', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await setCapacityOverride(id, '2025-01', 3.0, db);
			await removeCapacityOverride(id, '2025-01', db);

			const overrides = db.select().from(capacityOverrides).all();
			expect(overrides).toHaveLength(0);
		});

		it('should only remove the specified override', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await setCapacityOverride(id, '2025-01', 3.0, db);
			await setCapacityOverride(id, '2025-02', 4.0, db);

			await removeCapacityOverride(id, '2025-01', db);

			const overrides = db.select().from(capacityOverrides).all();
			expect(overrides).toHaveLength(1);
			expect(overrides[0].yearMonth).toBe('2025-02');
		});

		it('should handle removing non-existent override gracefully', async () => {
			const { id } = await createTeam(
				{
					name: 'Team',
					monthlyCapacity: 2.0
				},
				db
			);

			await expect(removeCapacityOverride(id, '2025-01', db)).resolves.not.toThrow();
		});
	});
});
