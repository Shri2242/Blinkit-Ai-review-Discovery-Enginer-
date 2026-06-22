import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadEnv() {
  if (process.env['DATABASE_URL']) {
    return;
  }

  const possiblePaths = [
    path.resolve(process.cwd(), '.env.development'),
    path.resolve(process.cwd(), '../../.env.development'),
    path.resolve(__dirname, '../../../.env.development'),
  ];

  for (const envPath of possiblePaths) {
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
      break;
    }
  }
}
