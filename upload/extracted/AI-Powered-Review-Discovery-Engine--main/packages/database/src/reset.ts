import { execSync } from 'child_process';
import readline from 'readline';

import { sql } from 'drizzle-orm';

import { loadEnv } from './env-loader.js';

async function reset() {
  loadEnv();

  const performReset = async () => {
    const { db } = await import('./client.js');

    console.warn('🧹 Clearing all tables (cascading truncation)...');
    await db.execute(
      sql`TRUNCATE TABLE activity_log, chat_messages, chat_sessions, insights, analytics_daily, saved_searches, reviews, upload_batches, project_members, projects, users CASCADE;`
    );
    console.warn('🌱 Re-running seed script...');
    execSync('npx tsx src/seed.ts', { stdio: 'inherit' });
    console.warn('✅ Database reset completed successfully!');
    process.exit(0);
  };

  const force = process.argv.includes('--force');
  if (force) {
    await performReset();
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    '⚠️ Are you sure you want to reset the database? This will TRUNCATE all tables! (y/N): ',
    async (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        try {
          await performReset();
        } catch (err) {
          console.error('❌ Reset failed:', err);
          process.exit(1);
        }
      } else {
        console.warn('❌ Reset cancelled.');
        process.exit(0);
      }
    }
  );
}

reset().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
