/**
 * Setup script for Turso database
 * Creates tables and initializes the database schema
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function setupTurso() {
  console.log('[Turso Setup] Starting Turso database setup...');
  
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!tursoUrl || !tursoAuthToken) {
    console.error('[Turso Setup] Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables');
    console.log('[Turso Setup] Please set these environment variables:');
    console.log('  TURSO_DATABASE_URL="libsql://your-database-your-org.turso.io"');
    console.log('  TURSO_AUTH_TOKEN="your-auth-token"');
    process.exit(1);
  }
  
  try {
    // Create Turso client
    console.log('[Turso Setup] Connecting to Turso database...');
    const client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
    
    // Check existing tables
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    console.log('[Turso Setup] Existing tables:', tables.rows.map(r => r.name));
    
    // Read migration SQL
    const migrationPath = join(process.cwd(), 'drizzle', '0000_chilly_devos.sql');
    const migrationSQL = await readFile(migrationPath, 'utf-8');
    
    // Split by statement breakpoint and execute each
    const statements = migrationSQL.split('--> statement-breakpoint');
    
    console.log('[Turso Setup] Running migrations...');
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      const sql = statement.trim();
      if (sql) {
        try {
          await client.execute(sql);
          successCount++;
        } catch (err) {
          errorCount++;
          console.error('[Turso Setup] Error executing statement:', err);
          console.error('[Turso Setup] Statement:', sql.substring(0, 100) + '...');
        }
      }
    }
    
    console.log(`[Turso Setup] Migration completed: ${successCount} successful, ${errorCount} errors`);
    
    // Verify tables were created
    const newTables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    console.log('[Turso Setup] Tables after migration:', newTables.rows.map(r => r.name));
    
    // Test connection
    console.log('[Turso Setup] Testing database connection...');
    const testResult = await client.execute('SELECT 1 as test');
    console.log('[Turso Setup] Connection test:', testResult.rows[0]);
    
    // Close connection
    client.close();
    
    console.log('[Turso Setup] Turso database setup completed successfully!');
    console.log('[Turso Setup] You can now deploy to Render with these environment variables:');
    console.log(`  TURSO_DATABASE_URL="${tursoUrl}"`);
    console.log(`  TURSO_AUTH_TOKEN="${tursoAuthToken}"`);
    
  } catch (error) {
    console.error('[Turso Setup] Error during setup:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTurso()
    .then(() => {
      console.log('[Turso Setup] Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Turso Setup] Failed:', error);
      process.exit(1);
    });
}

export { setupTurso };