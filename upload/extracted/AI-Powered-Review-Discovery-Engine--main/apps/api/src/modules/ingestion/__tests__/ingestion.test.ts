import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  createTestDb,
  resetTestDb,
  createTestUser,
  createTestProject,
} from '../../../__tests__/helpers/test-utils.js';
import { parseReviewsFile, normalizeReview } from '../file-parser.js';
import { ingestFromFile, getUploadHistory, getBatchDetails } from '../ingestion.service.js';

describe('Review Ingestion Pipeline', () => {
  let tempCsvPath: string;
  let tempJsonPath: string;
  let tempInvalidPath: string;

  beforeAll(async () => {
    await createTestDb();
    await resetTestDb();

    // Create temp files
    tempCsvPath = path.join(os.tmpdir(), 'test-reviews-ingestion.csv');
    tempJsonPath = path.join(os.tmpdir(), 'test-reviews-ingestion.json');
    tempInvalidPath = path.join(os.tmpdir(), 'test-reviews-ingestion.txt');

    const csvContent =
      'text,rating,title,date,source,author,external_id\n' +
      '"Great app, love the new checkout flow!",5,"Excellent UX",2025-01-15,app_store,john_doe,ext_001\n' +
      '"App crashes every time I try to pay",1,"Crash on payment",2025-01-14,app_store,jane_smith,ext_002\n' +
      '"Decent but needs dark mode",3,"Feature request",2025-01-13,play_store,bob_wilson,ext_003';

    const jsonContent = JSON.stringify([
      { text: 'Payment failed twice', rating: 1, source: 'app_store', external_id: 'ext_006' },
      {
        text: 'Great app, love the new checkout flow!',
        rating: 5,
        source: 'app_store',
        external_id: 'ext_001',
      },
      {
        text: 'Premium features worth the price',
        rating: 4,
        source: 'play_store',
        external_id: 'ext_007',
      },
    ]);

    fs.writeFileSync(tempCsvPath, csvContent, 'utf-8');
    fs.writeFileSync(tempJsonPath, jsonContent, 'utf-8');
    fs.writeFileSync(tempInvalidPath, 'Invalid text content', 'utf-8');
  });

  afterAll(async () => {
    // Delete temp files
    try {
      fs.unlinkSync(tempCsvPath);
      fs.unlinkSync(tempJsonPath);
      fs.unlinkSync(tempInvalidPath);
    } catch {
      // Ignore
    }
    await resetTestDb();
  });

  describe('File Parser & Normalizer', () => {
    it('should parse valid CSV files', async () => {
      const records = await parseReviewsFile(tempCsvPath, 'text/csv');
      expect(records).toHaveLength(3);
      expect(records[0]?.text).toBe('Great app, love the new checkout flow!');
      expect(records[0]?.rating).toBe('5');
      expect(records[0]?.external_id).toBe('ext_001');
    });

    it('should parse valid JSON files', async () => {
      const records = await parseReviewsFile(tempJsonPath, 'application/json');
      expect(records).toHaveLength(3);
      expect(records[0]?.text).toBe('Payment failed twice');
      expect(records[0]?.rating).toBe(1);
      expect(records[0]?.external_id).toBe('ext_006');
    });

    it('should throw error for unsupported mimetype', async () => {
      await expect(parseReviewsFile(tempInvalidPath, 'text/plain')).rejects.toThrow(
        'Unsupported file type'
      );
    });

    it('should normalize valid raw review', () => {
      const raw = {
        text: '   Excellent app!   ',
        rating: '4.2',
        title: 'Nice',
        date: '2025-01-15T12:00:00Z',
        source: '  APP_STORE  ',
        author: 'User1',
        external_id: 'ext123',
      };

      const normalized = normalizeReview(raw, 0);
      expect(normalized.text).toBe('Excellent app!');
      expect(normalized.rating).toBe(4);
      expect(normalized.title).toBe('Nice');
      expect(normalized.date.toISOString()).toBe('2025-01-15T12:00:00.000Z');
      expect(normalized.source).toBe('app_store');
      expect(normalized.author).toBe('User1');
      expect(normalized.externalId).toBe('ext123');
    });

    it('should throw error when text is missing in raw review', () => {
      const raw = {
        text: '',
        rating: '5',
      };
      expect(() => normalizeReview(raw, 2)).toThrow('Review at row 3: text is required');
    });
  });

  describe('Ingestion Flow Integration', () => {
    it('should execute full ingestion from file', async () => {
      const user = await createTestUser({ email: 'ingest-user@example.com' });
      const project = await createTestProject(user.id);

      // Ingest from CSV
      const result = await ingestFromFile(project.id, user.id, {
        path: tempCsvPath,
        mimetype: 'text/csv',
        size: fs.statSync(tempCsvPath).size,
        originalname: 'test-reviews.csv',
      });

      expect(result.batchId).toBeDefined();
      expect(result.totalRows).toBe(3);
      expect(result.inserted).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.status).toBe('completed');

      // Query history
      const history = await getUploadHistory(project.id);
      expect(history).toHaveLength(1);
      expect(history[0]?.filename).toBe('test-reviews.csv');
      expect(history[0]?.totalRows).toBe(3);
      expect(history[0]?.processedRows).toBe(3);

      // Ingest JSON with 1 duplicate and 2 new reviews
      const resultJson = await ingestFromFile(project.id, user.id, {
        path: tempJsonPath,
        mimetype: 'application/json',
        size: fs.statSync(tempJsonPath).size,
        originalname: 'test-reviews.json',
      });

      // ext_001 is a duplicate from the CSV ingestion, so it should be skipped
      expect(resultJson.inserted).toBe(2);
      expect(resultJson.skipped).toBe(1);
      expect(resultJson.status).toBe('completed');

      // Query batch details
      const batchDetails = await getBatchDetails(resultJson.batchId);
      expect(batchDetails.batch.id).toBe(resultJson.batchId);
      expect(batchDetails.reviews).toHaveLength(2); // Only inserted reviews are linked to the batch
    });
  });
});
