import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { dev } from '$app/environment';

/**
 * Get the database file path based on environment
 * In development: use local sqlite.db file
 * In production: use DATA_DIR environment variable or fallback to local
 */
function getDatabasePath(): string {
	if (dev) {
		return 'sqlite.db';
	}
	
	const dataDir = process.env.DATA_DIR;
	if (dataDir) {
		return `${dataDir}/sqlite.db`;
	}
	
	return 'sqlite.db';
}

/**
 * Initialize SQLite database connection with WAL mode enabled
 * WAL (Write-Ahead Logging) provides better concurrency for read operations
 */
const sqlite = new Database(getDatabasePath());

// Enable WAL mode for better read concurrency
sqlite.pragma('journal_mode = WAL');

// Enable foreign key constraints (SQLite disables them by default)
// This ensures CASCADE deletes and other referential actions execute
sqlite.pragma('foreign_keys = ON');

// Create Drizzle ORM instance
const db = drizzle(sqlite);

// Run migrations automatically on startup to ensure schema exists
// This eliminates the need to manually run `npm run migrate` before first use
try {
	migrate(db, { migrationsFolder: './drizzle' });
	console.log('✅ Database migrations completed');
} catch (error) {
	console.error('❌ Database migration failed:', error);
	throw error;
}

export { db };

// Export the raw SQLite instance for direct access if needed
export { sqlite };
