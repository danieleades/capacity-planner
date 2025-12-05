import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { teams, capacityOverrides, workPackages } from '$lib/server/schema';
import { seed } from '../../../scripts/seed.ts';

describe('Seed Script', () => {
	let testDir: string;
	let testDbPath: string;

	beforeEach(() => {
		// Create a temporary directory for the test database
		testDir = mkdtempSync(join(tmpdir(), 'seed-test-'));
		testDbPath = join(testDir, 'sqlite.db');
	});

	afterEach(() => {
		// Clean up test database files after test
		const files = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`];
		files.forEach((path) => {
			if (existsSync(path)) {
				try {
					unlinkSync(path);
				} catch {
					// Ignore errors during cleanup
				}
			}
		});
	});

	it('should populate the database with demo data', () => {
		const originalDataDir = process.env.DATA_DIR;
		process.env.DATA_DIR = testDir;

		try {
			seed();
		} finally {
			if (originalDataDir === undefined) {
				delete process.env.DATA_DIR;
			} else {
				process.env.DATA_DIR = originalDataDir;
			}
		}

		// Open the test database and verify data
		const sqlite = new Database(testDbPath);
		const db = drizzle(sqlite);

		try {
			// Verify teams table
			const teamsResult = db.select().from(teams).all();
			expect(teamsResult).toHaveLength(2);
			expect(teamsResult[0].name).toBeDefined();
			expect(teamsResult[0].monthlyCapacity).toBeGreaterThan(0);

			// Verify capacity overrides table
			const capacityOverridesResult = db.select().from(capacityOverrides).all();
			expect(capacityOverridesResult).toHaveLength(1);
			expect(capacityOverridesResult[0].capacity).toBeGreaterThan(0);

			// Verify work packages table
			const workPackagesResult = db.select().from(workPackages).all();
			expect(workPackagesResult).toHaveLength(5);

			// Verify scheduledPosition: 0 is preserved
			const workPackagesWithZeroPosition = workPackagesResult.filter(
				(wp) => wp.scheduledPosition === 0
			);
			expect(workPackagesWithZeroPosition.length).toBeGreaterThan(0);

			// Verify data integrity - foreign keys
			workPackagesResult.forEach((wp) => {
				if (wp.assignedTeamId) {
					const team = teamsResult.find((t) => t.id === wp.assignedTeamId);
					expect(team).toBeDefined();
				}
			});

			capacityOverridesResult.forEach((co) => {
				const team = teamsResult.find((t) => t.id === co.teamId);
				expect(team).toBeDefined();
			});

			// Verify non-null constraints
			teamsResult.forEach((team) => {
				expect(team.id).toBeDefined();
				expect(team.name).toBeDefined();
				expect(team.monthlyCapacity).toBeDefined();
				expect(team.createdAt).toBeDefined();
				expect(team.updatedAt).toBeDefined();
			});

			workPackagesResult.forEach((wp) => {
				expect(wp.id).toBeDefined();
				expect(wp.title).toBeDefined();
				expect(wp.sizeInPersonMonths).toBeDefined();
				expect(wp.priority).toBeDefined();
				expect(wp.createdAt).toBeDefined();
				expect(wp.updatedAt).toBeDefined();
			});
		} finally {
			sqlite.close();
		}
	});
});
