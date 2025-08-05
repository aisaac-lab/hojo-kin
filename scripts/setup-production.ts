/**
 * Production setup script
 * Ensures database is properly initialized for production environment
 */

import { createClient } from '@libsql/client';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function setupProduction() {
  console.log('[Setup] Starting production setup...');
  
  try {
    // Get database URL
    const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db';
    console.log('[Setup] Database URL:', databaseUrl);
    
    // Extract path from URL
    const dbPath = databaseUrl.replace('file:', '');
    const dbDir = resolve(process.cwd(), dbPath.substring(0, dbPath.lastIndexOf('/')));
    
    // Ensure directory exists
    if (!existsSync(dbDir)) {
      console.log('[Setup] Creating database directory:', dbDir);
      mkdirSync(dbDir, { recursive: true });
    }
    
    // Create client
    const client = createClient({
      url: databaseUrl,
    });
    
    // Check if tables exist
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    console.log('[Setup] Existing tables:', tables.rows.map(r => r.name));
    
    // If no tables or missing validation tables, run migration
    const tableNames = tables.rows.map(r => r.name as string);
    const requiredTables = ['threads', 'messages', 'subsidies', 'review_logs', 'validation_loops', 'validation_results'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.log('[Setup] Missing tables:', missingTables);
      console.log('[Setup] Running migrations...');
      
      // Read and execute migration SQL
      const migrationPath = join(process.cwd(), 'drizzle', '0000_chilly_devos.sql');
      const migrationSQL = await readFile(migrationPath, 'utf-8');
      
      // Split by statement breakpoint and execute each
      const statements = migrationSQL.split('--> statement-breakpoint');
      
      for (const statement of statements) {
        const sql = statement.trim();
        if (sql) {
          try {
            await client.execute(sql);
          } catch (err) {
            console.error('[Setup] Error executing statement:', err);
            console.error('[Setup] Statement:', sql.substring(0, 100) + '...');
          }
        }
      }
      
      console.log('[Setup] Migrations completed!');
      
      // Verify tables were created
      const newTables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log('[Setup] Tables after migration:', newTables.rows.map(r => r.name));
    } else {
      console.log('[Setup] All required tables exist!');
    }
    
    // Close connection
    client.close();
    
    console.log('[Setup] Production setup completed successfully!');
    
  } catch (error) {
    console.error('[Setup] Error during production setup:', error);
    // Don't exit with error to allow the app to start anyway
    console.log('[Setup] Continuing despite errors...');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupProduction()
    .then(() => {
      console.log('[Setup] Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Setup] Failed:', error);
      process.exit(1);
    });
}

export { setupProduction };