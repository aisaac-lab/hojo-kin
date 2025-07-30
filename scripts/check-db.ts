import { createClient } from '@libsql/client';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = resolve(__dirname, '../prisma/dev.db');

async function checkDatabase() {
  const client = createClient({
    url: `file:${dbPath}`,
  });

  try {
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    const subsidies = await client.execute('SELECT COUNT(*) as count FROM subsidies');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

checkDatabase();