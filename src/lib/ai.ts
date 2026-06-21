/**
 * ReviewPulse — AI analysis library (server-only).
 *
 * Wraps z-ai-web-dev-sdk. Provides:
 *  - analyzeReviews(): batch sentiment/theme/priority/summary/key-phrases extraction
 *  - ragChat(): retrieval-augmented chat over reviews with cited sources
 *
 * Uses keyword/TF-IDF retrieval instead of pgvector (SQLite has no vector extension),
 * which matches the "keyword fallback" path described in the spec.
 */
import "server-only";
import ZAI from "z-ai-web-dev-sdk";

export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type Priority = "critical" | "high" | "medium" | "low";

export interface AnalysisResult {
  sentiment: Sentiment;
  sentimentScore: number;
  theme: string;
  subTheme: string;
  priority: Priority;
  priorityReason: string;
  summary: string;
  keyPhrases: string[];
  isBug: boolean;
  isFeatureRequest: boolean;
  isActionable: boolean;
}

export interface ReviewForAnalysis {
  id: string;
  text: string;
  rating: number;
  source: string;
}

const ANALYSIS_SYSTEM_PROMPT = `You are a senior product analyst working on a music streaming app (Spotify).
You analyze user reviews to surface product insights.

For EACH review provided, return a STRICT JSON ARRAY (no markdown, no prose) where every element has EXACTLY these keys:
- "sentiment": one of "positive" | "negative" | "neutral" | "mixed"
- "sentimentScore": number 0..1 (confidence)
- "theme": short snake_case theme, e.g. "music_discovery", "recommendation_quality", "playlist_fatigue", "ui_ux", "playback_bug", "offline_mode", "pricing", "social_features", "audio_quality", "search"
- "subTheme": short snake_case sub-theme
- "priority": one of "critical" | "high" | "medium" | "low"
- "priorityReason": one short sentence
- "summary": one sentence paraphrase of the review
- "keyPhrases": array of 2-5 short quoted phrases from the review
- "isBug": boolean
- "isFeatureRequest": boolean
- "isActionable": boolean (true if the team could ship something to address it)

Return ONLY the JSON array. Do not wrap in code fences.`;

let zaiPromise: Promise<unknown> | null = null;
async function getZai() {
  if (!zaiPromise) {
    zaiPromise = ZAI.create();
  }
  return zaiPromise;
}

/** Strip markdown code fences and extract the first JSON array from a model response. */
function extractJsonArray(content: string): unknown[] {
  let text = content.trim();
  // Remove ```json ... ``` fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Find first '[' ... last ']'
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON array found in model response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

/** Heuristic fallback used when the LLM call fails. Never throws. */
export function heuristicAnalysis(r: ReviewForAnalysis): AnalysisResult {
  const t = r.text.toLowerCase();
  const negative =
    /hate|terrible|worst|broken|bug|crash|annoying|frustrat|useless|garbage|awful|stuck|repeat|same song|can't find|hard to find|missing|broken|freez|laggy|paywall|expensive|ads/.test(
      t,
    );
  const positive = /love|great|amazing|perfect|awesome|best|fantastic|excellent|happy/.test(t);
  const bug = /crash|bug|freeze|broken|glitch|error|won't play|stops|lag/.test(t);
  const feature = /wish|would love|should add|need a|please add|feature request|missing feature|bring back|could you/.test(
    t,
  );

  let sentiment: Sentiment = "neutral";
  if (negative && positive) sentiment = "mixed";
  else if (negative) sentiment = "negative";
  else if (positive) sentiment = "positive";

  let theme = "general";
  if (/discover|recommend|suggestion|new music|new artist|find new/.test(t)) theme = "music_discovery";
  else if (/playlist|repeat|same song|bored|tired of/.test(t)) theme = "playlist_fatigue";
  else if (/crash|bug|freeze|broken|glitch|error|lag/.test(t)) theme = "playback_bug";
  else if (/offline|download/.test(t)) theme = "offline_mode";
  else if (/price|subscription|premium|paywall|expensive|ads/.test(t)) theme = "pricing";
  else if (/ui|interface|layout|design|navigation|confusing/.test(t)) theme = "ui_ux";
  else if (/search|find songs|hard to find/.test(t)) theme = "search";
  else if (/social|share|friend|follow/.test(t)) theme = "social_features";
  else if (/quality|sound|audio|bitrate/.test(t)) theme = "audio_quality";

  let priority: Priority = "medium";
  if (bug) priority = "critical";
  else if (negative && theme === "music_discovery") priority = "high";
  else if (feature) priority = "medium";
  else if (sentiment === "positive") priority = "low";

  const phrases = (t.match(/"([^"]+)"|‘([^’]+)’|“([^”]+)”/g) || [])
    .map((s) => s.replace(/["'‘’“”]/g, "").trim())
    .filter((s) => s.length > 2)
    .slice(0, 3);

  return {
    sentiment,
    sentimentScore: sentiment === "neutral" ? 0.5 : negative ? 0.85 : 0.8,
    theme,
    subTheme: theme,
    priority,
    priorityReason: bug
      ? "Reported crash/bug affects core playback."
      : theme === "music_discovery"
        ? "Directly impacts the discovery growth metric."
        : feature
          ? "Explicit feature request from a user."
          : "Signal worth tracking.",
    summary: r.text.slice(0, 120) + (r.text.length > 120 ? "…" : ""),
    keyPhrases: phrases,
    isBug: bug,
    isFeatureRequest: feature,
    isActionable: bug || feature || theme === "music_discovery",
  };
}

/**
 * Analyze a batch of reviews with the LLM. Falls back to heuristics on any error.
 * Returns one AnalysisResult per input review (order preserved).
 */
export async function analyzeReviews(
  reviews: ReviewForAnalysis[],
): Promise<AnalysisResult[]> {
  if (reviews.length === 0) return [];
  try {
    const zai = (await getZai()) as {
      chat: {
        completions: {
          create: (args: {
            messages: { role: string; content: string }[];
            thinking: { type: string };
          }) => Promise<{ choices: { message: { content?: string } }[] }>;
        };
      };
    };

    const userContent =
      `Analyze these ${reviews.length} reviews. Return a JSON array of ${reviews.length} objects in the SAME ORDER.\n\n` +
      reviews
        .map((r, i) => `#${i + 1} [rating=${r.rating}, source=${r.source}]\n${r.text}`)
        .join("\n\n");

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const arr = extractJsonArray(raw) as Partial<AnalysisResult>[];

    // Map back, falling back per-item if shape is wrong.
    return reviews.map((r, i) => {
      const item = arr[i];
      if (!item || typeof item !== "object") return heuristicAnalysis(r);
      const fallback = heuristicAnalysis(r);
      return {
        sentiment: (item.sentiment as Sentiment) || fallback.sentiment,
        sentimentScore:
          typeof item.sentimentScore === "number"
            ? item.sentimentScore
            : fallback.sentimentScore,
        theme: item.theme || fallback.theme,
        subTheme: item.subTheme || fallback.subTheme,
        priority: (item.priority as Priority) || fallback.priority,
        priorityReason: item.priorityReason || fallback.priorityReason,
        summary: item.summary || fallback.summary,
        keyPhrases: Array.isArray(item.keyPhrases)
          ? item.keyPhrases.map(String)
          : fallback.keyPhrases,
        isBug: typeof item.isBug === "boolean" ? item.isBug : fallback.isBug,
        isFeatureRequest:
          typeof item.isFeatureRequest === "boolean"
            ? item.isFeatureRequest
            : fallback.isFeatureRequest,
        isActionable:
          typeof item.isActionable === "boolean"
            ? item.isActionable
            : fallback.isActionable,
      };
    });
  } catch (err) {
    console.error("[ai] analyzeReviews failed, using heuristic fallback:", err);
    return reviews.map(heuristicAnalysis);
  }
}

/* ----------------------------- RAG chat ----------------------------- */

const RAG_SYSTEM_PROMPT = `You are a product analyst bot for a music streaming app.
Answer the user's question STRICTLY based on the provided review excerpts ("CONTEXT").
- Be concise and decision-oriented.
- When you use a piece of context, cite it like [1], [2] referring to the numbered excerpts.
- If the context does not contain enough information, say so explicitly.
- Do not invent reviews or numbers that are not in the context.`;

export interface RagSource {
  reviewId: string;
  text: string;
  author: string;
  source: string;
  rating: number;
  score: number; // relevance 0..1
}

export interface RagResult {
  answer: string;
  sources: RagSource[];
}

/** Tokenize for keyword retrieval. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Simple keyword-overlap retrieval (TF-IDF-ish). Returns top-N scored reviews. */
export function retrieveReviews(
  question: string,
  reviews: { id: string; text: string; author: string; source: string; rating: number }[],
  topN = 8,
): RagSource[] {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0 || reviews.length === 0) return [];

  // Build doc frequency
  const df = new Map<string, number>();
  for (const r of reviews) {
    const seen = new Set(tokenize(r.text));
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = reviews.length;

  const scored = reviews.map((r) => {
    const tokens = tokenize(r.text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    let score = 0;
    for (const t of qTokens) {
      const f = tf.get(t);
      if (!f) continue;
      const d = df.get(t) || 0;
      const idf = Math.log((N + 1) / (d + 1)) + 1;
      score += f * idf;
    }
    // Normalize by doc length a bit
    score = score / (1 + Math.log(1 + tokens.length));
    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, topN);
  const max = top[0]?.score || 1;
  return top.map((s) => ({
    reviewId: s.r.id,
    text: s.r.text,
    author: s.r.author,
    source: s.r.source,
    rating: s.r.rating,
    score: s.score / max,
  }));
}

/** Run a RAG chat turn: retrieve -> prompt -> answer. */
export async function ragChat(
  question: string,
  reviews: { id: string; text: string; author: string; source: string; rating: number }[],
): Promise<RagResult> {
  const sources = retrieveReviews(question, reviews, 8);
  let answer: string;
  if (sources.length === 0) {
    answer =
      "I couldn't find any reviews matching your question. Try asking about a specific theme like discovery, recommendations, playlists, bugs, or pricing.";
  } else {
    const context = sources
      .map(
        (s, i) =>
          `[${i + 1}] (rating=${s.rating}, source=${s.source}, author=${s.author})\n${s.text}`,
      )
      .join("\n\n");

    try {
      const zai = (await getZai()) as {
        chat: {
          completions: {
            create: (args: {
              messages: { role: string; content: string }[];
              thinking: { type: string };
            }) => Promise<{ choices: { message: { content?: string } }[] }>;
          };
        };
      };
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: RAG_SYSTEM_PROMPT },
          {
            role: "user",
            content: `CONTEXT (review excerpts):\n${context}\n\nQUESTION: ${question}\n\nAnswer based only on the context. Cite with [n].`,
          },
        ],
        thinking: { type: "disabled" },
      });
      answer =
        completion.choices[0]?.message?.content?.trim() ||
        "I couldn't generate an answer. Please try rephrasing.";
    } catch (err) {
      console.error("[ai] ragChat LLM call failed:", err);
      // Compose a transparent fallback answer from the retrieved snippets.
      const snippets = sources
        .slice(0, 4)
        .map((s, i) => `• [${i + 1}] "${s.text.slice(0, 140)}${s.text.length > 140 ? "…" : ""}"`)
        .join("\n");
      answer = `Based on the most relevant reviews I found:\n${snippets}\n\n(This is a keyword-retrieval fallback because the language model was unavailable.)`;
    }
  }
  return { answer, sources };
}
