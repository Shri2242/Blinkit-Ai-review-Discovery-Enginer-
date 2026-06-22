// @ts-expect-error No type definitions available for app-store-scraper
import store from 'app-store-scraper';

import type { CollectedReview } from './google-play.js';

interface AppStoreConfig {
  appId: string;
  country?: string;
  maxReviews?: number;
}

export async function collectAppStoreReviews(config: AppStoreConfig): Promise<CollectedReview[]> {
  const reviews = await store.reviews({
    id: config.appId,
    country: config.country || 'us',
    sort: store.sort.RECENT,
    page: 1,
    num: config.maxReviews || 200,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return reviews.map((r: any) => ({
    text: r.text || '',
    rating: r.score || null,
    title: r.title || null,
    date: new Date(r.updated),
    source: 'app_store',
    author: r.userName || null,
    externalId: r.id?.toString() || null,
  }));
}
