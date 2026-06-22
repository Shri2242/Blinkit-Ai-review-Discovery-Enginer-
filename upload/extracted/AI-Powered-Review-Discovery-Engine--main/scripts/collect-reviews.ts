/* eslint-disable no-console */
import 'dotenv/config';
import astore from 'app-store-scraper';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import gplay from 'google-play-scraper';
import { Pool } from 'pg';

import * as schema from '../packages/database/src/schema/index.js';
import {
  collectorSources,
  reviews as reviewsTable,
} from '../packages/database/src/schema/index.js';

interface CollectedReview {
  text: string;
  rating: number | null;
  title: string | null;
  date: Date;
  source: string;
  author: string | null;
  externalId: string | null;
}

async function collectGooglePlay(config: Record<string, unknown>): Promise<CollectedReview[]> {
  const reviews = await gplay.reviews({
    appId: config.appId as string,
    lang: (config.lang as string) || 'en',
    country: (config.country as string) || 'us',
    sort: gplay.sort.NEWEST,
    num: (config.maxReviews as number) || 200,
  });
  return reviews.data.map((r) => ({
    text: r.text || r.title || '',
    rating: r.score || null,
    title: r.title || null,
    date: new Date(r.date),
    source: 'google_play',
    author: r.userName || null,
    externalId: r.id || null,
  }));
}

async function collectAppStore(config: Record<string, unknown>): Promise<CollectedReview[]> {
  const reviews = await astore.reviews({
    id: config.appId as string,
    country: (config.country as string) || 'us',
    sort: astore.sort.RECENT,
    page: 1,
    num: (config.maxReviews as number) || 200,
  });
  return reviews.map((r) => ({
    text: r.text || '',
    rating: r.score || null,
    title: r.title || null,
    date: new Date(r.updated),
    source: 'app_store',
    author: r.userName || null,
    externalId: r.id?.toString() || null,
  }));
}

async function collectReddit(config: Record<string, unknown>): Promise<CollectedReview[]> {
  const subreddit = config.subreddit as string;
  const queries = (config.queries as string[]) || ['spotify'];
  const maxPosts = (config.maxPosts as number) || 100;
  const results: CollectedReview[] = [];

  for (const query of queries) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&limit=50`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'ReviewPulse/1.0 (GitHub Actions)' },
      });
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        data: {
          children: Array<{
            data: {
              title: string;
              selftext: string;
              created_utc: number;
              author: string;
              id: string;
            };
          }>;
        };
      };
      for (const child of data.data.children) {
        const p = child.data;
        const text = p.selftext ? `${p.title}\n\n${p.selftext}` : p.title;
        if (text.trim().length < 10) continue;
        results.push({
          text: text.substring(0, 5000),
          rating: null,
          title: p.title,
          date: new Date(p.created_utc * 1000),
          source: 'reddit',
          author: `u/${p.author}`,
          externalId: `reddit_${p.id}`,
        });
      }
    } catch (err) {
      console.error(`Reddit "${query}" failed:`, (err as Error).message);
    }
  }

  const seen = new Set<string>();
  return results
    .filter((r) => {
      if (!r.externalId || seen.has(r.externalId)) return false;
      seen.add(r.externalId);
      return true;
    })
    .slice(0, maxPosts);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('Starting automated review collection...');
  const sources = await db
    .select()
    .from(collectorSources)
    .where(eq(collectorSources.enabled, true));
  console.log(`Found ${sources.length} enabled source(s)`);

  let totalFetched = 0,
    totalInserted = 0,
    totalSkipped = 0;

  for (const source of sources) {
    console.log(`\nProcessing: ${source.name} (${source.source_type})`);
    const config = source.config as Record<string, unknown>;
    let reviews: CollectedReview[] = [];

    try {
      switch (source.source_type) {
        case 'google_play':
          reviews = await collectGooglePlay(config);
          break;
        case 'app_store':
          reviews = await collectAppStore(config);
          break;
        case 'reddit':
          reviews = await collectReddit(config);
          break;
        default:
          console.log(`Unknown type: ${source.source_type}`);
          continue;
      }
    } catch (err) {
      console.error(`Failed:`, (err as Error).message);
      await db
        .update(collectorSources)
        .set({
          last_run_at: new Date(),
          last_run_status: 'failed',
          error_message: (err as Error).message,
          updated_at: new Date(),
        })
        .where(eq(collectorSources.id, source.id));
      continue;
    }

    console.log(`Fetched ${reviews.length} reviews`);
    let inserted = 0,
      skipped = 0;

    for (const review of reviews) {
      try {
        if (!review.text.trim()) continue;
        if (review.externalId) {
          const existing = await db
            .select({ id: reviewsTable.id })
            .from(reviewsTable)
            .where(
              and(
                eq(reviewsTable.project_id, source.project_id),
                eq(reviewsTable.source_review_id, review.externalId)
              )
            )
            .limit(1);
          if (existing.length > 0) {
            skipped++;
            continue;
          }
        }
        await db.insert(reviewsTable).values({
          project_id: source.project_id,
          text: review.text.trim(),
          rating: review.rating,
          title: review.title,
          review_date: review.date,
          source: review.source,
          author: review.author,
          source_review_id: review.externalId,
          processed: false,
        });
        inserted++;
      } catch {
        /* skip individual errors */
      }
    }

    totalFetched += reviews.length;
    totalInserted += inserted;
    totalSkipped += skipped;

    await db
      .update(collectorSources)
      .set({
        last_run_at: new Date(),
        last_run_status: 'success',
        last_run_count: inserted,
        total_collected: (source.total_collected || 0) + inserted,
        error_message: null,
        updated_at: new Date(),
      })
      .where(eq(collectorSources.id, source.id));

    console.log(`${source.name}: ${inserted} new, ${skipped} duplicates`);
  }

  console.log(
    `\nSUMMARY: ${totalFetched} fetched, ${totalInserted} inserted, ${totalSkipped} duplicates`
  );
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
