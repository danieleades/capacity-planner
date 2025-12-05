import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { pathToFileURL } from 'url';
import { teams, capacityOverrides, workPackages } from '../src/lib/server/schema.js';

/**
 * Get the database file path based on environment
 */
function getDatabasePath(): string {
	const dataDir = process.env.DATA_DIR;
	if (dataDir) {
		return `${dataDir}/sqlite.db`;
	}
	return 'sqlite.db';
}

/**
 * Initialize database connection for seed script
 */
function createDb() {
	const sqlite = new Database(getDatabasePath());
	sqlite.pragma('journal_mode = WAL');
	return { sqlite, db: drizzle(sqlite) };
}

/**
 * Seed script for populating the database with demo data.
 * Creates a fresh connection so it can be reused in tests.
 */
export function seed() {
	const { sqlite, db } = createDb();

	console.log('🌱 Starting database seed...');

	try {
		// Run migrations first to ensure tables exist
		console.log('🔄 Running migrations...');
		migrate(db, { migrationsFolder: './drizzle' });
		console.log('✅ Migrations applied');

		// Clear existing data (in reverse order of dependencies)
		console.log('🧹 Clearing existing data...');
		db.delete(capacityOverrides).run();
		db.delete(workPackages).run();
		db.delete(teams).run();
		console.log('✅ Existing data cleared');

		// Generate UUIDs for teams
		const platformTeamId = crypto.randomUUID();
		const frontendTeamId = crypto.randomUUID();

		// Insert demo teams
		console.log('👥 Inserting teams...');
		db.insert(teams)
			.values([
				{
					id: platformTeamId,
					name: 'Platform Team',
					monthlyCapacity: 2.5,
					createdAt: new Date(),
					updatedAt: new Date()
				},
				{
					id: frontendTeamId,
					name: 'Frontend Team',
					monthlyCapacity: 3.0,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			])
			.run();
		console.log('✅ Teams inserted');

		// Insert capacity overrides
		console.log('📊 Inserting capacity overrides...');
		db.insert(capacityOverrides)
			.values([
				{
					id: crypto.randomUUID(),
					teamId: platformTeamId,
					yearMonth: '2025-12',
					capacity: 0.7,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			])
			.run();
		console.log('✅ Capacity overrides inserted');

		// Insert work packages
		console.log('📦 Inserting work packages...');
		db.insert(workPackages)
			.values([
				{
					id: crypto.randomUUID(),
					title: 'User Authentication System',
					description: 'Implement OAuth2 and JWT-based authentication',
					sizeInPersonMonths: 1.5,
					priority: 0,
					assignedTeamId: platformTeamId,
					scheduledPosition: 0,
					createdAt: new Date(),
					updatedAt: new Date()
				},
				{
					id: crypto.randomUUID(),
					title: 'API Rate Limiting',
					description: 'Add rate limiting to all public API endpoints',
					sizeInPersonMonths: 0.8,
					priority: 1,
					assignedTeamId: platformTeamId,
					scheduledPosition: 1,
					createdAt: new Date(),
					updatedAt: new Date()
				},
				{
					id: crypto.randomUUID(),
					title: 'Dashboard Redesign',
					description: 'Modernize the main dashboard UI',
					sizeInPersonMonths: 2.0,
					priority: 2,
					assignedTeamId: frontendTeamId,
					scheduledPosition: 0,
					createdAt: new Date(),
					updatedAt: new Date()
				},
				{
					id: crypto.randomUUID(),
					title: 'Mobile Responsive Design',
					description: 'Make all pages mobile-friendly',
					sizeInPersonMonths: 1.2,
					priority: 3,
					assignedTeamId: platformTeamId,
					scheduledPosition: 2,
					createdAt: new Date(),
					updatedAt: new Date()
				},
				{
					id: crypto.randomUUID(),
					title: 'Database Migration',
					description: 'Migrate from PostgreSQL to Aurora',
					sizeInPersonMonths: 3.0,
					priority: 4,
					assignedTeamId: frontendTeamId,
					scheduledPosition: 1,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			])
			.run();
		console.log('✅ Work packages inserted');

		console.log('🎉 Seed completed successfully!');
		console.log(`   - 2 teams`);
		console.log(`   - 1 capacity override`);
		console.log(`   - 5 work packages`);
	} catch (error) {
		console.error('❌ Seed failed:', error);
		throw error;
	} finally {
		// Ensure database connection is closed
		sqlite.close();
	}
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

if (isMain) {
	try {
		seed();
		process.exit(0);
	} catch (error) {
		console.error('❌ Unexpected error:', error);
		process.exit(1);
	}
}
