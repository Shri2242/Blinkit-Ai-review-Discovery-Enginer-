import fs from 'fs';
import path from 'path';

import { defineConfig } from 'vitest/config';

// Load test environment variables
try {
  const envPath = path.resolve(process.cwd(), '.env.test');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index > 0) {
          const key = trimmed.substring(0, index).trim();
          const value = trimmed.substring(index + 1).trim();
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.warn('Failed to load .env.test dynamically', e);
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      exclude: [
        'node_modules',
        'dist',
        '**/*.config.*',
        '**/*.d.ts',
        '**/seed.ts',
        'apps/**/*',
        'packages/database/**/*',
        'packages/ai/**/*',
        'vitest.workspace.ts',
      ],
    },
  },
});
