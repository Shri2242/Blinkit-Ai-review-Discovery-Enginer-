import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

import {
  SentimentEnum,
  ReviewSourceEnum,
  isSuccess,
  ApiResponse,
  ApiError,
  MAX_FILE_SIZE_BYTES,
  AI_BATCH_SIZE,
  THEME_TAXONOMY,
} from '../index.js';

describe('Shared types and constants', () => {
  it('SentimentEnum accepts valid values', () => {
    const valid = ['positive', 'negative', 'neutral', 'mixed'];
    valid.forEach((val) => {
      const parsed = SentimentEnum.parse(val);
      expect(parsed).toBe(val);
    });
  });

  it('SentimentEnum rejects invalid values', () => {
    const invalid = ['happy', '', undefined, null];
    invalid.forEach((val) => {
      expect(() => SentimentEnum.parse(val)).toThrow(ZodError);
    });
  });

  it('ReviewSourceEnum has all expected values', () => {
    const expectedSources = [
      'csv_upload',
      'app_store',
      'google_play',
      'trustpilot',
      'g2',
      'steam',
      'reddit',
      'twitter',
      'zendesk',
      'intercom',
      'manual_entry',
    ];

    expect(ReviewSourceEnum.options).toHaveLength(expectedSources.length);
    expectedSources.forEach((source) => {
      expect(ReviewSourceEnum.options).toContain(source);
    });
  });

  it('ApiResponse type guard works', () => {
    const successResp: ApiResponse<string> = {
      success: true,
      data: 'hello',
    };

    const errorResp: ApiError = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access Denied',
      },
    };

    expect(isSuccess(successResp)).toBe(true);
    expect(isSuccess(errorResp)).toBe(false);
  });

  it('Constants are defined correctly', () => {
    expect(MAX_FILE_SIZE_BYTES).toBeGreaterThan(0);
    expect(AI_BATCH_SIZE).toBeGreaterThan(0);
    expect(THEME_TAXONOMY.length).toBeGreaterThan(0);
  });
});
