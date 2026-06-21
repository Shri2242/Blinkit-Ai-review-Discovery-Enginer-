/**
 * ReviewPulse — Collector sources.
 *
 * In the full monorepo spec these would call google-play-scraper,
 * app-store-scraper, the Reddit JSON API, and Apify for Twitter.
 *
 * In this single-app sandbox we can't reliably reach those external
 * APIs, so each collector returns a small, realistic batch of
 * freshly-fetched sample reviews (with unique sourceReviewIds so the
 * dedup logic in /api/collect actually exercises the "duplicate"
 * branch on subsequent runs).
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

const GOOGLE_PLAY_SAMPLES: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[] = [
  {
    title: "Discover Weekly is broken",
    text: "My Discover Weekly used to introduce me to new artists. Now it just recycles songs I already have in my library. Feels like the algorithm gave up.",
    rating: 2,
    author: "Marcus T.",
  },
  {
    title: "Great for finding new music",
    text: "Release Radar actually surfaces new drops from artists I follow. Found three new bands this month. Keep it up.",
    rating: 5,
    author: "Priya K.",
  },
  {
    title: "Same songs on repeat",
    text: "Every time I open the app it auto-plays the same 15 songs. I want to discover new music, not relive yesterday.",
    rating: 2,
    author: "Diego R.",
  },
];

const APP_STORE_SAMPLES: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[] = [
  {
    title: "Recommendations are stuck",
    text: "I liked one lo-fi playlist months ago and now my whole home screen is lo-fi. I like other genres too! The recommendation engine is way too narrow.",
    rating: 2,
    author: "sarah_music_99",
  },
  {
    title: "Wish I could explore by mood",
    text: "Would love a proper mood-based discovery that isn't just 'Focus' or 'Chill'. Give me 'melancholic autumn evening' playlists.",
    rating: 4,
    author: "jordanplays",
  },
  {
    title: "Crashes on offline mode",
    text: "Downloaded playlists for my flight and the app crashed every time I tried to play them offline. Useless.",
    rating: 1,
    author: "FrequentFlyer22",
  },
];

const REDDIT_SAMPLES: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[] = [
  {
    title: null,
    text: "Anyone else feel like Spotify's algorithm is in a rut? My Daily Mixes haven't changed in weeks. I miss the serendipity of finding something totally unexpected.",
    rating: 2,
    author: "u/playlist_wanderer",
  },
  {
    title: null,
    text: "Unpopular opinion: Spotify's discovery is actually decent IF you actively train it. Dislike songs you hate, follow small artists. It learns. Most people don't bother.",
    rating: 4,
    author: "u/deep_cuts_only",
  },
  {
    title: null,
    text: "The 'Fans also like' section is just mainstream pop no matter what genre I'm in. Indie band? Here's Taylor Swift. Useless.",
    rating: 1,
    author: "u/indie_is_dead",
  },
];

const TWITTER_SAMPLES: Omit<FetchedReview, "sourceReviewId" | "contentHash" | "source">[] = [
  {
    title: null,
    text: "spotify really said 'you listened to one jazz song, here's 5000 jazz songs forever' 😭 the discovery algorithm is a joke",
    rating: 2,
    author: "@music_nerd_42",
  },
  {
    title: null,
    text: "genuinely impressed with the new AI DJ feature. actually introduced me to an artist i'd never heard and now they're my most listened. more of this please @Spotify",
    rating: 5,
    author: "@beatseeker",
  },
];

/** Build a timestamped batch of sample reviews for a given source type. */
export function collectSampleReviews(
  sourceType: string,
  sourceName: string,
): FetchedReview[] {
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
    case "reddit":
      base = REDDIT_SAMPLES;
      source = "reddit";
      break;
    case "twitter":
      base = TWITTER_SAMPLES;
      source = "twitter";
      break;
    default:
      return [];
  }
  const stamp = Date.now();
  return base.map((b, i) => ({
    ...b,
    source,
    sourceReviewId: `${source}:${sourceName}:${stamp}:${i}`,
    contentHash: hash(b.text),
  }));
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
    description: "Discussions from a subreddit (public JSON API, no key needed).",
    configFields: [
      { key: "subreddit", label: "Subreddit", placeholder: "spotify", required: true },
      { key: "sort", label: "Sort", placeholder: "hot", required: false },
    ],
  },
  {
    type: "twitter",
    label: "Twitter / X",
    description: "Tweets matching a query (requires an Apify key in production).",
    configFields: [
      { key: "query", label: "Query", placeholder: "spotify discovery", required: true },
      { key: "limit", label: "Limit", placeholder: "100", required: false },
    ],
  },
] as const;
