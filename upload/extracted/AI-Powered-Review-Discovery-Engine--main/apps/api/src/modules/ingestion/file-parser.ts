import fs from 'fs';

import { parse } from 'csv-parse';

import { ValidationError } from '../../lib/errors.js';

export interface RawReview {
  text: string;
  rating?: number | string;
  title?: string;
  date?: string;
  source?: string;
  author?: string;
  external_id?: string;
}

export interface NormalizedReview {
  text: string;
  rating: number | null;
  title: string | null;
  date: Date;
  source: string;
  author: string | null;
  externalId: string | null;
}

/**
 * Parses a CSV or JSON review file and returns raw review objects.
 */
export async function parseReviewsFile(
  filePath: string,
  mimeType: string,
  originalName?: string
): Promise<RawReview[]> {
  const nameToCheck = originalName || filePath;
  const isCsv =
    mimeType === 'text/csv' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType.toLowerCase().includes('csv') ||
    nameToCheck.toLowerCase().endsWith('.csv');
  const isJson =
    mimeType === 'application/json' ||
    mimeType.toLowerCase().includes('json') ||
    nameToCheck.toLowerCase().endsWith('.json');

  if (!isCsv && !isJson) {
    throw new ValidationError('Unsupported file type. Only CSV and JSON are accepted.');
  }

  if (isCsv) {
    return parseReviewsCsv(filePath);
  }
  return parseReviewsJson(filePath);
}

function parseReviewsCsv(filePath: string): Promise<RawReview[]> {
  return new Promise((resolve, reject) => {
    const results: RawReview[] = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const fileStream = fs.createReadStream(filePath, 'utf-8');

    fileStream
      .pipe(parser)
      .on('data', (row: RawReview) => {
        results.push(row);
      })
      .on('error', (err: Error) => {
        reject(new ValidationError(`CSV parse error: ${err.message}`));
      })
      .on('end', () => {
        if (results.length === 0) {
          reject(new ValidationError('CSV file is empty'));
          return;
        }
        resolve(results);
      });
  });
}

function parseReviewsJson(filePath: string): Promise<RawReview[]> {
  return new Promise((resolve, reject) => {
    let content = '';
    const stream = fs.createReadStream(filePath, 'utf-8');

    stream.on('data', (chunk: string | Buffer) => {
      content += chunk.toString();
    });

    stream.on('error', (err: Error) => {
      reject(new ValidationError(`JSON read error: ${err.message}`));
    });

    stream.on('end', () => {
      try {
        const parsed: unknown = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          reject(new ValidationError('JSON file must contain an array of reviews'));
          return;
        }
        resolve(parsed as RawReview[]);
      } catch {
        reject(new ValidationError('Invalid JSON format'));
      }
    });
  });
}

/**
 * Normalizes and validates raw review records.
 */
export function normalizeReview(raw: RawReview, index: number): NormalizedReview {
  // text: required, trim, must be > 0 chars
  const text = (raw.text || '').trim();
  if (!text) {
    throw new ValidationError(`Review at row ${index + 1}: text is required`);
  }

  // rating: parse to number 1-5, null if missing/invalid
  let rating: number | null = null;
  if (raw.rating !== undefined && raw.rating !== '') {
    const parsed = Number(raw.rating);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      rating = Math.round(parsed);
    }
  }

  // title: optional, trim
  const title = raw.title ? String(raw.title).trim() || null : null;

  // date: parse to Date, default to now if missing/invalid
  let reviewDate: Date = new Date();
  if (raw.date) {
    const parsed = new Date(raw.date);
    if (!isNaN(parsed.getTime())) {
      reviewDate = parsed;
    }
  }

  // source: normalize to lowercase, default "manual"
  const source = (raw.source || 'manual').toLowerCase().trim();

  // author: optional
  const author = raw.author ? String(raw.author).trim() || null : null;

  // external_id: optional, for deduplication
  const externalId = raw.external_id ? String(raw.external_id).trim() || null : null;

  return { text, rating, title, date: reviewDate, source, author, externalId };
}
