/* eslint-disable no-console */
import 'dotenv/config';
import { execSync } from 'child_process';

async function main() {
  const startTime = Date.now();
  console.log('REVIEW PULSE DAILY PIPELINE');
  console.log(`Time: ${new Date().toISOString()}\n`);

  const steps = [
    { name: '1. Collect Reviews', script: 'scripts/collect-reviews.ts' },
    { name: '2. Process with AI', script: 'scripts/process-reviews.ts' },
    { name: '3. Generate Embeddings', script: 'scripts/generate-embeddings.ts' },
  ];

  for (const step of steps) {
    console.log(`\n${'='.repeat(50)}\n${step.name}\n${'='.repeat(50)}`);
    try {
      execSync(`npx tsx ${step.script}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env },
      });
      console.log(`${step.name} SUCCESS`);
    } catch {
      console.error(`${step.name} FAILED (continuing)`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nPIPELINE COMPLETE in ${duration}s`);
}

main();
