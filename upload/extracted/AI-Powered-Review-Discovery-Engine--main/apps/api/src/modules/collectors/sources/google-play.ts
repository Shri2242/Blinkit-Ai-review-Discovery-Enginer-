import gplay from 'google-play-scraper';

export interface CollectedReview {
  text: string;
  rating: number | null;
  title: string | null;
  date: Date;
  source: string;
  author: string | null;
  externalId: string | null;
}

interface GooglePlayConfig {
  appId: string;
  lang?: string;
  country?: string;
  maxReviews?: number;
}

export async function collectGooglePlayReviews(
  config: GooglePlayConfig
): Promise<CollectedReview[]> {
  const reviews = await gplay.reviews({
    appId: config.appId,
    lang: config.lang || 'en',
    country: config.country || 'us',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sort: (gplay.sort as any).NEWEST,
    num: config.maxReviews || 200,
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
