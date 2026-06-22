import type { CollectedReview } from './google-play.js';

interface RedditConfig {
  subreddit: string;
  queries?: string[];
  maxPosts?: number;
}

export async function collectRedditPosts(config: RedditConfig): Promise<CollectedReview[]> {
  const queries = config.queries || ['spotify'];
  const maxPosts = config.maxPosts || 100;
  const results: CollectedReview[] = [];

  for (const query of queries) {
    try {
      const url = `https://www.reddit.com/r/${config.subreddit}/search.json?q=${encodeURIComponent(
        query
      )}&restrict_sr=on&sort=new&limit=50`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'ReviewPulse/1.0 (Graduation Project)' },
      });

      if (!response.ok) continue;

      const data = (await response.json()) as {
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
      console.error(`Reddit query "${query}" failed:`, (err as Error).message);
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
