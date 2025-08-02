import { beforeEach, afterEach } from 'vitest';
import { db, closeDb } from '../../app/db.server';
import * as schema from '../../app/db/schema';

beforeEach(async () => {
	// Connection is handled automatically by the db module
});

afterEach(async () => {
	// Clear all tables
	await db.delete(schema.messages);
	await db.delete(schema.threads);
	await db.delete(schema.subsidies);

	// Close connection after all tests
	await closeDb();
});
