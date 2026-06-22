import { sql } from 'drizzle-orm';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { db } from '@review-engine/database';

import {
  createTestDb,
  resetTestDb,
  createTestUser,
  createTestProject,
  createTestReview,
  createTestReviews,
  createAuthToken,
} from './helpers/test-utils.js';

describe('Database test helpers', () => {
  beforeAll(async () => {
    // Ensure the test database is created/exists and reset it
    await createTestDb();
    await resetTestDb();
  });

  afterAll(async () => {
    // Cleanup database
    await resetTestDb();
  });

  it('creates a test user successfully', async () => {
    const user = await createTestUser({
      email: 'unique-test-user@example.com',
      name: 'Integration Test User',
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBe('unique-test-user@example.com');
    expect(user.name).toBe('Integration Test User');
    expect(user.role).toBe('admin');
  });

  it('creates a test project and joins members successfully', async () => {
    const user = await createTestUser({
      email: 'project-owner@example.com',
    });

    const project = await createTestProject(user.id, {
      name: 'Integration Test Project',
    });

    expect(project).toBeDefined();
    expect(project.id).toBeDefined();
    expect(project.name).toBe('Integration Test Project');
    expect(project.ownerId).toBe(user.id);

    // Verify member link
    const members = await db.execute(
      sql`SELECT * FROM project_members WHERE project_id = ${project.id} AND user_id = ${user.id}`
    );
    expect(members.length).toBe(1);
  });

  it('creates a single test review successfully', async () => {
    const user = await createTestUser({
      email: 'review-owner@example.com',
    });
    const project = await createTestProject(user.id);

    const review = await createTestReview(project.id, {
      reviewText: 'Excellent application performance and clean UI.',
      rating: 5,
    });

    expect(review).toBeDefined();
    expect(review.id).toBeDefined();
    expect(review.reviewText).toBe('Excellent application performance and clean UI.');
    expect(review.rating).toBe(5);
    expect(review.processingStatus).toBe('pending');
  });

  it('creates bulk test reviews with rotated values successfully', async () => {
    const user = await createTestUser({
      email: 'bulk-owner@example.com',
    });
    const project = await createTestProject(user.id);

    const count = 10;
    const insertedReviews = await createTestReviews(project.id, count);

    expect(insertedReviews).toHaveLength(count);

    // Check formatting and rotated variables
    // Rotated sentiments: positive, negative, neutral, mixed
    // Rotated themes: payment, performance, usability, features
    expect(insertedReviews[0]?.sentiment).toBe('positive');
    expect(insertedReviews[0]?.theme).toBe('payment');
    expect(insertedReviews[0]?.priority).toBe('critical');

    expect(insertedReviews[1]?.sentiment).toBe('negative');
    expect(insertedReviews[1]?.theme).toBe('performance');
    expect(insertedReviews[1]?.priority).toBe('high');

    expect(insertedReviews[2]?.sentiment).toBe('neutral');
    expect(insertedReviews[2]?.theme).toBe('usability');
    expect(insertedReviews[2]?.priority).toBe('medium');
  });

  it('generates a valid authentication token', () => {
    const userId = 'user-123';
    const email = 'token-user@example.com';
    const role = 'user';

    const authHeader = createAuthToken(userId, email, role);
    expect(authHeader).toBeDefined();
    expect(authHeader.startsWith('Bearer ')).toBe(true);

    const token = authHeader.split(' ')[1]!;
    expect(token).toBeDefined();
  });
});
