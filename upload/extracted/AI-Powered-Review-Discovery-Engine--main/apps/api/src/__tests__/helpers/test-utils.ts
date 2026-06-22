import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';

import { users, projects, reviews, projectMembers } from '@review-engine/database';
import { db } from '@review-engine/database';
import { env } from '@review-engine/shared';

/**
 * Creates the test database if it does not already exist.
 */
export async function createTestDb(): Promise<void> {
  const connectionString = env.DATABASE_URL;
  // Parse connection URL to connect to the default postgres database
  const url = new URL(connectionString);
  url.pathname = '/postgres';

  const client = postgres(url.toString(), { max: 1 });
  try {
    const exists = await client`SELECT 1 FROM pg_database WHERE datname = 'review_engine_test'`;
    if (exists.length === 0) {
      await client`CREATE DATABASE review_engine_test`;
    }
  } catch (error) {
    console.error('Failed to create test database:', error);
  } finally {
    await client.end();
  }
}

/**
 * Resets the test database by truncating all tables in cascade.
 */
export async function resetTestDb(): Promise<void> {
  // Truncating all existing tables in order
  await db.execute(
    sql`TRUNCATE TABLE webhook_deliveries, webhook_configs, report_schedules, activity_log, chat_messages, insights, analytics_daily, review_embeddings, reviews, upload_batches, collector_logs, collector_sources, project_members, projects, users CASCADE;`
  );
}

/**
 * Creates a test user in the database.
 */
export async function createTestUser(overrides?: Partial<typeof users.$inferInsert>) {
  const passwordHash = await bcrypt.hash(overrides?.passwordHash || 'Test@12345', 4);

  const [user] = await db
    .insert(users)
    .values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Test',
      isActive: true,
      ...overrides,
    })
    .returning();

  if (!user) {
    throw new Error('Failed to create test user');
  }
  return user;
}

/**
 * Creates a test project and joins the owner to it.
 */
export async function createTestProject(
  ownerId: string,
  overrides?: Partial<typeof projects.$inferInsert>
) {
  const [project] = await db
    .insert(projects)
    .values({
      name: 'Test Project',
      ownerId,
      description: 'A test project description',
      settings: {},
      ...overrides,
    })
    .returning();

  if (!project) {
    throw new Error('Failed to create test project');
  }

  await db.insert(projectMembers).values({
    projectId: project.id,
    userId: ownerId,
    role: 'admin',
  });

  return project;
}

/**
 * Creates a test review in the database.
 */
export async function createTestReview(
  projectId: string,
  overrides?: Partial<typeof reviews.$inferInsert>
) {
  const reviewText = overrides?.reviewText || 'This is a test review about payment issues';
  const contentHash =
    overrides?.contentHash || crypto.createHash('sha256').update(reviewText).digest('hex');

  const [review] = await db
    .insert(reviews)
    .values({
      projectId,
      source: 'csv_upload',
      reviewText,
      rating: 3,
      reviewDate: new Date(),
      contentHash,
      processingStatus: 'pending',
      ...overrides,
    })
    .returning();

  if (!review) {
    throw new Error('Failed to create test review');
  }
  return review;
}

/**
 * Generates a Bearer token string.
 */
export function createAuthToken(userId: string, email: string, role: string): string {
  const token = jwt.sign({ sub: userId, email, role }, env.JWT_SECRET, {
    expiresIn: '15m',
  });
  return `Bearer ${token}`;
}

/**
 * Bulk inserts multiple test reviews with varied sentiments, themes, and priorities.
 */
export async function createTestReviews(projectId: string, count: number) {
  const sentiments = ['positive', 'negative', 'neutral', 'mixed'] as const;
  const themes = ['payment', 'performance', 'usability', 'features'] as const;
  const priorities = ['critical', 'high', 'medium', 'low'] as const;

  const reviewsToInsert: Array<typeof reviews.$inferInsert> = [];

  for (let i = 0; i < count; i++) {
    const sentiment = sentiments[i % sentiments.length]!;
    const theme = themes[i % themes.length]!;
    const priority = priorities[i % priorities.length]!;
    const rating = sentiment === 'positive' ? 5 : sentiment === 'negative' ? 1 : 3;
    const reviewText = `Test review ${i + 1} with focus on ${theme} and sentiment ${sentiment}`;
    const contentHash = crypto.createHash('sha256').update(reviewText).digest('hex');

    reviewsToInsert.push({
      projectId,
      source: 'csv_upload',
      sourceReviewId: `rev-test-${i}`,
      reviewText,
      reviewTitle: `Test review ${i + 1}`,
      rating,
      reviewDate: new Date(Date.now() - i * 3600 * 1000),
      language: 'en',
      contentHash,
      processingStatus: 'completed',
      processedAt: new Date(),
      sentiment,
      sentimentConfidence: 0.9,
      theme,
      subTheme: `${theme} issues`,
      priority,
      priorityReason: 'Automated rotation value in test suite helper.',
      keyPhrases: [theme, sentiment],
      aiSummary: `Summary of ${reviewText}`,
      isBug: theme === 'performance',
      isFeatureRequest: theme === 'features',
      actionable: sentiment === 'negative',
    });
  }

  const inserted = await db.insert(reviews).values(reviewsToInsert).returning();
  return inserted;
}
