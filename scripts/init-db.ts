/**
 * Initialize SQLite database with Drizzle
 * Following functional programming patterns
 */

import { createClient } from '@libsql/client';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = resolve(__dirname, '../prisma');
const dbPath = resolve(dbDir, 'dev.db');

async function initializeDatabase() {

  // Ensure the directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const client = createClient({
    url: `file:${dbPath}`,
  });

  try {
    // Enable foreign keys
    await client.execute('PRAGMA foreign_keys = ON');

    // Create tables
    await client.execute(`
      CREATE TABLE IF NOT EXISTS threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT UNIQUE NOT NULL,
        user_id TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS subsidies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jgrants_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        target_audience TEXT,
        amount TEXT,
        deadline TEXT,
        requirements TEXT,
        application_url TEXT,
        ministry TEXT,
        vector_store_id TEXT,
        file_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Create indexes
    await client.execute('CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_subsidies_jgrants_id ON subsidies(jgrants_id)');


    // Verify tables were created
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
  } finally {
    client.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to initialize database:', error);
      process.exit(1);
    });
}

export { initializeDatabase };