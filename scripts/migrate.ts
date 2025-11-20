import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

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
 * Run database migrations
 */
async function runMigrations() {
	console.log('🔄 Running database migrations...');

	try {
		const sqlite = new Database(getDatabasePath());
		sqlite.pragma('journal_mode = WAL');
		const db = drizzle(sqlite);

		migrate(db, { migrationsFolder: './drizzle' });

		console.log('✅ Migrations completed successfully!');
		sqlite.close();
	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	}
}

// Run migrations
runMigrations()
	.then(() => {
		process.exit(0);
	})
	.catch((error) => {
		console.error('❌ Unexpected error:', error);
		process.exit(1);
	});
