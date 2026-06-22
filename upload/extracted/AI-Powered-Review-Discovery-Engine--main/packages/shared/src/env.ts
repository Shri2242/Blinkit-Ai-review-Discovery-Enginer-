import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis URL').optional(),
  DEEPSEEK_API_KEY: z.string().min(1, 'DEEPSEEK_API_KEY is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL').optional(),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required').optional(),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required').optional(),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required').optional(),
  CHROMADB_URL: z.string().url('CHROMADB_URL must be a valid URL').optional(),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const missingVars = parseResult.error.errors
    .map((err) => {
      const path = err.path.join('.');
      return `  ❌ ${path}: ${err.message}`;
    })
    .join('\n');
  const errorMsg = `Environment validation failed!\n${missingVars}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

export const env: AppEnv = parseResult.data;
