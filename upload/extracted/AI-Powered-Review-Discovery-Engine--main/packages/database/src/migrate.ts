import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { loadEnv } from './env-loader.js';

async function main() {
  loadEnv();
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  console.warn('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.warn('Migrations complete.');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
