import type { Config } from 'drizzle-kit';

export default {
	schema: './app/db/schema.ts',
	out: './drizzle',
	driver: 'libsql',
	dbCredentials: {
		url:
			process.env.DATABASE_URL?.replace('file:', 'file:') || 'file:./db/dev.db',
	},
} satisfies Config;
