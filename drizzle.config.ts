import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: process.env.DATA_DIR ? `${process.env.DATA_DIR}/sqlite.db` : 'sqlite.db'
	}
});
