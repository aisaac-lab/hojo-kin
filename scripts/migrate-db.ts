/**
 * Database migration script for production
 * Creates all necessary tables if they don't exist
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { resolve } from 'path';
import * as schema from '../app/db/schema';

async function runMigrations() {
  console.log('[Migration] Starting database migration...');
  
  try {
    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db';
    console.log('[Migration] Database URL:', databaseUrl);
    
    // Create client
    const client = createClient({
      url: databaseUrl,
    });
    
    // Create drizzle instance
    const db = drizzle(client);
    
    // Run migrations
    console.log('[Migration] Running migrations from drizzle folder...');
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log('[Migration] Migrations completed successfully!');
    
    // Verify tables exist
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    console.log('[Migration] Existing tables:', tables.rows.map(r => r.name));
    
    // Close connection
    client.close();
    
  } catch (error) {
    console.error('[Migration] Error running migrations:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('[Migration] All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Migration] Failed:', error);
      process.exit(1);
    });
}

export { runMigrations };