#!/usr/bin/env tsx
/**
 * Turso database migration script with automatic env loading
 * Run migrations on the remote Turso database
 */

import 'dotenv/config'; // This will automatically load .env file
import { createClient } from '@libsql/client';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function migrateTurso() {
  console.log('[Migrate] Starting Turso database migration...');
  
  // Check for required environment variables
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!tursoUrl || !tursoAuthToken) {
    console.error('[Migrate] Missing required environment variables:');
    console.error('  TURSO_DATABASE_URL:', tursoUrl ? 'Set' : 'Missing');
    console.error('  TURSO_AUTH_TOKEN:', tursoAuthToken ? 'Set' : 'Missing');
    process.exit(1);
  }
  
  try {
    // Create Turso client
    console.log('[Migrate] Connecting to Turso database...');
    const client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
    
    // Test connection
    await client.execute('SELECT 1');
    console.log('[Migrate] Connected successfully!');
    
    // Check existing tables
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    console.log('[Migrate] Existing tables:', tables.rows.map(r => r.name));
    
    // Read migration SQL
    const migrationPath = join(process.cwd(), 'drizzle', '0000_chilly_devos.sql');
    console.log('[Migrate] Reading migration from:', migrationPath);
    const migrationSQL = await readFile(migrationPath, 'utf-8');
    
    // Split by statement breakpoint and execute each
    const statements = migrationSQL.split('--> statement-breakpoint');
    
    console.log('[Migrate] Executing', statements.length, 'SQL statements...');
    
    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i].trim();
      if (sql) {
        try {
          console.log(`[Migrate] Executing statement ${i + 1}/${statements.length}...`);
          await client.execute(sql);
        } catch (err) {
          console.error(`[Migrate] Error executing statement ${i + 1}:`, err);
          console.error('[Migrate] Statement:', sql.substring(0, 100) + '...');
          throw err;
        }
      }
    }
    
    console.log('[Migrate] Migration completed successfully!');
    
    // Verify tables were created
    const newTables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    console.log('[Migrate] Tables after migration:', newTables.rows.map(r => r.name));
    
    // Close connection
    client.close();
    
  } catch (error) {
    console.error('[Migrate] Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateTurso()
  .then(() => {
    console.log('[Migrate] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migrate] Failed:', error);
    process.exit(1);
  });