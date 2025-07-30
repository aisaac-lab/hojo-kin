import { beforeEach, afterEach } from 'vitest';
import { prisma, closeDb } from '../../app/db';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../../app/db/schema';

const client = createClient({
  url: 'file:./prisma/dev.db',
});
const db = drizzle(client, { schema });

beforeEach(async () => {
  // Connection is handled automatically by the db module
});

afterEach(async () => {
  // Clear all tables
  await db.delete(schema.messages);
  await db.delete(schema.threads);
  await db.delete(schema.subsidies);
  
  // Close connection after all tests
  await prisma.$disconnect();
});