// ─────────────────────────────────────────────────────────────────────────────
// Database client — postgres.js + Drizzle ORM
// ─────────────────────────────────────────────────────────────────────────────

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required. See .env.example for reference.');
}

const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 30,
});

export const db = drizzle(client, { schema });
