import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { teams, capacityOverrides, workPackages } from '$lib/server/schema';

/**
 * Create an in-memory test database with schema applied
 * Returns a Drizzle instance ready for testing
 */
export function createTestDb() {
	const sqlite = new Database(':memory:');
	const db = drizzle(sqlite);

	// Create tables directly instead of using migrations
	db.run(sql`
		CREATE TABLE teams (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			monthly_capacity REAL NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`);

	db.run(sql`
		CREATE TABLE capacity_overrides (
			id TEXT PRIMARY KEY,
			team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
			year_month TEXT NOT NULL,
			capacity REAL NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			UNIQUE(team_id, year_month)
		)
	`);

	db.run(sql`
		CREATE INDEX capacity_overrides_team_id_idx ON capacity_overrides(team_id)
	`);

	db.run(sql`
		CREATE TABLE work_packages (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			description TEXT,
			size_in_person_months REAL NOT NULL,
			priority INTEGER NOT NULL,
			assigned_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
			scheduled_position INTEGER,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`);

	db.run(sql`
		CREATE INDEX work_packages_assigned_team_idx ON work_packages(assigned_team_id)
	`);

	db.run(sql`
		CREATE INDEX work_packages_priority_idx ON work_packages(priority)
	`);

	return { db, sqlite };
}

/**
 * Clear all data from test database tables
 * Useful for resetting state between tests
 */
export function clearTestDb(db: ReturnType<typeof drizzle>) {
	db.delete(capacityOverrides).run();
	db.delete(workPackages).run();
	db.delete(teams).run();
}

/**
 * Close the test database connection
 */
export function closeTestDb(sqlite: Database.Database) {
	sqlite.close();
}
