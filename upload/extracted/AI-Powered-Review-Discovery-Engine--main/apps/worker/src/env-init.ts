import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';

const nodeEnv = process.env['NODE_ENV'] || 'development';
const envFileName =
  nodeEnv === 'test' ? '.env.test' : nodeEnv === 'production' ? '.env' : '.env.development';

const possiblePaths = [
  path.resolve(process.cwd(), envFileName),
  path.resolve(process.cwd(), `../../${envFileName}`),
];

for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
