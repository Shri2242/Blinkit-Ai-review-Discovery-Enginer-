/* eslint-disable no-console */
import type { CollectedReview } from './google-play.js';

interface TwitterConfig {
  queries: string[];
  maxTweets?: number;
  apifyApiKey?: string;
}

export async function collectTweets(config: TwitterConfig): Promise<CollectedReview[]> {
  const results: CollectedReview[] = [];

  if (!config.apifyApiKey) {
    console.info('Twitter collection requires Apify API key. Skipping.');
    return results;
  }

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~twitter-scraper/runs?token=${config.apifyApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: config.queries,
          maxTweets: config.maxTweets || 100,
          sort: 'Latest',
        }),
      }
    );

    const runData = (await response.json()) as { data: { id: string } };
    const runId = runData.data.id;

    let status = 'RUNNING';
    let attempts = 0;
    while (status === 'RUNNING' && attempts < 12) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${config.apifyApiKey}`
      );
      const statusData = (await statusRes.json()) as { data: { status: string } };
      status = statusData.data.status;
      attempts++;
    }

    if (status === 'SUCCEEDED') {
      const itemsRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${config.apifyApiKey}`
      );
      const items = (await itemsRes.json()) as Array<{
        text: string;
        created_at: string;
        user: { screen_name: string };
        id_str: string;
      }>;

      for (const tweet of items) {
        if (!tweet.text || tweet.text.length < 20) continue;
        results.push({
          text: tweet.text,
          rating: null,
          title: null,
          date: new Date(tweet.created_at),
          source: 'twitter',
          author: `@${tweet.user?.screen_name}`,
          externalId: `twitter_${tweet.id_str}`,
        });
      }
    }
  } catch (err) {
    console.error('Twitter collection failed:', (err as Error).message);
  }

  return results.slice(0, config.maxTweets || 100);
}
