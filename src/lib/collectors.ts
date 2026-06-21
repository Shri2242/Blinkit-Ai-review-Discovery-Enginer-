/**
 * ReviewPulse — Collector sources.
 *
 * Real collection is attempted where the public API is reachable from the
 * sandbox:
 *   - reddit:   public JSON API (https://www.reddit.com/r/.../search.json) — NO KEY
 *   - google_play / app_store / twitter: external scrapers may be blocked or
 *     require keys, so we fall back to a realistic sample batch with unique
 *     sourceReviewIds (so the dedup path still exercises the "duplicate"
 *     branch on subsequent runs).
 *
 * Every collector returns FetchedReview[] with a contentHash so /api/collect
 * can dedup against existing rows.
 */
import { createHash } from "crypto";

export interface FetchedReview {
  text: string;
  title: string | null;
  rating: number;
  source: "google_play" | "app_store" | "reddit" | "twitter";
  author: string;
  sourceReviewId: string;
  contentHash: string;
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/* ----------------------------- Real Reddit collector ----------------------------- */

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  createdUtc: number;
  score: number;
}

/** Fetch real posts from a subreddit via Reddit's public JSON API (no auth). */
export async function fetchRedditPosts(
  subreddit: string,
  query?: string,
  limit = 25,
): Promise<RedditPost[]> {
  const base = query
    ? `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?restrict_sr=1&q=${encodeURIComponent(query)}&sort=new&limit=${limit}`
    : `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=${limit}`;
  const res = await fetch(base, {
    headers: { "User-Agent": "ReviewPulse/1.0 (review-discovery-engine)" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Reddit API returned ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { children?: { data: RedditPost }[] };
  };
  const children = json?.data?.children ?? [];
  return children
    .map((c) => c.data)
    .filter((p): p is RedditPost => !!p && !!p.id && (!!p.title || !!p.selftext));
}

/** Convert a Reddit post into a FetchedReview (rating inferred from sentiment words). */
function redditPostToFetched(post: RedditPost): FetchedReview {
  const text = post.selftext?.trim()
    ? `${post.title}. ${post.selftext.trim()}`
    : post.title.trim();
  const lower = text.toLowerCase();
  // Crude rating inference from sentiment words — these are real user posts
  // that don't carry a 1-5 rating, so we estimate for the analysis pipeline.
  const neg = /(hate|broken|bug|crash|terrible|awful|worst|frustrat|annoying|useless|can't|broken)/.test(lower);
  const pos = /(love|great|amazing|perfect|awesome|best|fantastic|excellent)/.test(lower);
  const rating = neg ? (pos ? 2 : 1) : pos ? 5 : 3;
  return {
    text: text.slice(0, 2000),
    title: post.title.slice(0, 500),
    rating,
    source: "reddit",
    author: post.author ? `u/${post.author}` : "u/unknown",
    sourceReviewId: `reddit:${post.subreddit}:${post.id}`,
    contentHash: hash(text),
  };
}

/* ----------------------------- Simulated samples (fallback) ----------------------------- */

const GOOGLE_PLAY_SAMPLES: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[] = [
  { title: "Discover Weekly is broken", text: "My Discover Weekly used to introduce me to new artists. Now it just recycles songs I already have in my library. Feels like the algorithm gave up.", rating: 2, author: "Marcus T." },
  { title: "Great for finding new music", text: "Release Radar actually surfaces new drops from artists I follow. Found three new bands this month. Keep it up.", rating: 5, author: "Priya K." },
  { title: "Same songs on repeat", text: "Every time I open the app it auto-plays the same 15 songs. I want to discover new music, not relive yesterday.", rating: 2, author: "Diego R." },
];

const APP_STORE_SAMPLES: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[] = [
  { title: "Recommendations are stuck", text: "I liked one lo-fi playlist months ago and now my whole home screen is lo-fi. I like other genres too! The recommendation engine is way too narrow.", rating: 2, author: "sarah_music_99" },
  { title: "Wish I could explore by mood", text: "Would love a proper mood-based discovery that isn't just 'Focus' or 'Chill'. Give me 'melancholic autumn evening' playlists.", rating: 4, author: "jordanplays" },
  { title: "Crashes on offline mode", text: "Downloaded playlists for my flight and the app crashed every time I tried to play them offline. Useless.", rating: 1, author: "FrequentFlyer22" },
];

const REDDIT_SAMPLES: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[] = [
  { title: null, text: "Anyone else feel like Spotify's algorithm is in a rut? My Daily Mixes haven't changed in weeks. I miss the serendipity of finding something totally unexpected.", rating: 2, author: "u/playlist_wanderer" },
  { title: null, text: "Unpopular opinion: Spotify's discovery is actually decent IF you actively train it. Dislike songs you hate, follow small artists. It learns. Most people don't bother.", rating: 4, author: "u/deep_cuts_only" },
  { title: null, text: "The 'Fans also like' section is just mainstream pop no matter what genre I'm in. Indie band? Here's Taylor Swift. Useless.", rating: 1, author: "u/indie_is_dead" },
];

const TWITTER_SAMPLES: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[] = [
  { title: null, text: "spotify really said 'you listened to one jazz song, here's 5000 jazz songs forever' the discovery algorithm is a joke", rating: 2, author: "@music_nerd_42" },
  { title: null, text: "genuinely impressed with the new AI DJ feature. actually introduced me to an artist i'd never heard and now they're my most listened. more of this please @Spotify", rating: 5, author: "@beatseeker" },
];

/**
 * Collect a batch of reviews for a source. For Reddit this attempts a REAL
 * fetch from the public JSON API; for the others it returns a realistic
 * sample batch (the external scrapers require keys / are often blocked).
 */
export async function collectReviews(
  sourceType: string,
  sourceName: string,
  config: Record<string, unknown> = {},
): Promise<{ reviews: FetchedReview[]; real: boolean }> {
  if (sourceType === "reddit") {
    const subreddit = (config.subreddit as string) || "spotify";
    const query = config.query as string | undefined;
    try {
      const posts = await fetchRedditPosts(subreddit, query, 25);
      if (posts.length > 0) {
        return { reviews: posts.map(redditPostToFetched), real: true };
      }
    } catch (err) {
      console.warn(`[collectors] Reddit fetch failed for r/${subreddit}, using fallback:`, err);
    }
    // Fallback to sample reddit posts.
    return { reviews: stampSamples(REDDIT_SAMPLES, "reddit", sourceName), real: false };
  }

  let base: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[];
  let source: FetchedReview["source"];
  switch (sourceType) {
    case "google_play":
      base = GOOGLE_PLAY_SAMPLES;
      source = "google_play";
      break;
    case "app_store":
      base = APP_STORE_SAMPLES;
      source = "app_store";
      break;
    case "twitter":
      base = TWITTER_SAMPLES;
      source = "twitter";
      break;
    default:
      return { reviews: [], real: false };
  }
  return { reviews: stampSamples(base, source, sourceName), real: false };
}

function stampSamples(
  base: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[],
  source: FetchedReview["source"],
  sourceName: string,
): FetchedReview[] {
  const stamp = Date.now();
  return base.map((b, i) => ({
    ...b,
    source,
    sourceReviewId: `${source}:${sourceName}:${stamp}:${i}`,
    contentHash: hash(b.text),
  }));
}

/** Back-compat: synchronous sample collector used by older call sites. */
export function collectSampleReviews(sourceType: string, sourceName: string): FetchedReview[] {
  let base: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[];
  let source: FetchedReview["source"];
  switch (sourceType) {
    case "google_play": base = GOOGLE_PLAY_SAMPLES; source = "google_play"; break;
    case "app_store": base = APP_STORE_SAMPLES; source = "app_store"; break;
    case "reddit": base = REDDIT_SAMPLES; source = "reddit"; break;
    case "twitter": base = TWITTER_SAMPLES; source = "twitter"; break;
    default: return [];
  }
  return stampSamples(base, source, sourceName);
}

export const SOURCE_TYPE_INFO = [
  {
    type: "google_play",
    label: "Google Play",
    description: "Reviews from the Google Play Store for a given app ID.",
    configFields: [
      { key: "appId", label: "App ID", placeholder: "com.spotify.music", required: true },
      { key: "lang", label: "Language", placeholder: "en", required: false },
    ],
  },
  {
    type: "app_store",
    label: "App Store",
    description: "Reviews from the Apple App Store for a given numeric app ID.",
    configFields: [
      { key: "appId", label: "App ID", placeholder: "324684580", required: true },
      { key: "country", label: "Country", placeholder: "us", required: false },
    ],
  },
  {
    type: "reddit",
    label: "Reddit",
    description: "Posts from a subreddit via the public JSON API (no key needed). Real fetch attempted.",
    configFields: [
      { key: "subreddit", label: "Subreddit", placeholder: "spotify", required: true },
      { key: "query", label: "Search query (optional)", placeholder: "discovery", required: false },
    ],
  },
  {
    type: "twitter",
    label: "Twitter / X",
    description: "Tweets matching a query (requires an Apify/Twitter API key in production).",
    configFields: [
      { key: "query", label: "Query", placeholder: "spotify discovery", required: true },
      { key: "limit", label: "Limit", placeholder: "100", required: false },
    ],
  },
] as const;
