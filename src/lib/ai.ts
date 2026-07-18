/**
 * ReviewPulse — AI analysis library (server-only).
 *
 * LLM provider priority:
 *   1. Hugging Face (FREE — when HUGGINGFACE_API_KEY is set)
 *   2. DeepSeek (when DEEPSEEK_API_KEY is set)
 *   3. z-ai-web-dev-sdk (sandbox default — always available)
 *
 * Retrieval: real 384-dim neural embeddings via @xenova/transformers + cosine
 * similarity (see embeddings.ts). Falls back to keyword TF-IDF if the model
 * can't load.
 */
import "server-only";
import ZAI from "z-ai-web-dev-sdk";
import { isHuggingFaceConfigured, getHuggingFaceModel, huggingfaceChat } from "./huggingface";
import { isGeminiConfigured, getGeminiModel, geminiChat } from "./gemini";

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

/**
 * Canonical theme taxonomy for ReviewPulse. Keys are the snake_case theme
 * identifiers used by the LLM and stored in the DB; values are the
 * human-readable labels the frontend renders. The ANALYSIS_SYSTEM_PROMPT and
 * heuristicAnalysis function must stay in sync with these keys.
 */
export const THEME_TAXONOMY: Record<string, string> = {
  payment: "Payment",
  performance: "Performance",
  usability: "Usability",
  onboarding: "Onboarding",
  features: "Features",
  support: "Support",
  pricing: "Pricing",
  security: "Security",
  reliability: "Reliability",
  content: "Content",
  other: "Other",
};

/** All valid theme keys (derived from THEME_TAXONOMY so they never drift). */
export const THEME_KEYS = Object.keys(THEME_TAXONOMY);

/** Human-readable label for a theme key, falling back to the raw key. */
export function themeLabel(theme: string | null | undefined): string {
  if (!theme) return "Other";
  return THEME_TAXONOMY[theme] ?? theme;
}

const ANALYSIS_SYSTEM_PROMPT = `You are a senior product analyst. You analyze user reviews to surface product insights.

Use ONLY this theme taxonomy:
- "payment" — checkout, billing, transactions, refunds, charges
- "performance" — speed, crashes, loading time, freezing, lag
- "usability" — navigation, UI confusion, accessibility, design
- "onboarding" — signup, setup, first-time experience, tutorial
- "features" — feature requests, missing functionality, wishlist
- "support" — customer service experience, response time, helpfulness
- "pricing" — cost complaints, plan confusion, value perception, subscription
- "security" — privacy concerns, data handling, account security
- "reliability" — bugs, data loss, unexpected behavior, errors
- "content" — content quality, relevance, moderation
- "other" — truly unclassifiable (use sparingly)

For EACH review provided, return a STRICT JSON ARRAY (no markdown, no prose) where every element has EXACTLY these keys (snake_case):
- "review_index": number (1-based index of the review in the input order)
- "sentiment": one of "positive" | "negative" | "neutral" | "mixed"
- "sentiment_confidence": number 0..1
- "theme": one of the 11 themes listed above
- "sub_theme": short specific topic (snake_case)
- "priority": one of "critical" | "high" | "medium" | "low"
- "priority_reason": one short sentence
- "key_phrases": array of 2-5 short quoted phrases from the review
- "summary": one sentence paraphrase of the review
- "actionable": boolean (true if the team could ship something to address it)
- "is_bug": boolean
- "is_feature_request": boolean

Return ONLY the JSON array. Do not wrap in code fences. Preserve input order.`;

let zaiPromise: Promise<unknown> | null = null;
async function getZai() {
  if (!zaiPromise) {
    zaiPromise = ZAI.create();
  }
  return zaiPromise;
}

interface LLMMessage { role: string; content: string }

/**
 * Unified LLM call. Provider priority:
 *   1. Hugging Face (FREE) — when HUGGINGFACE_API_KEY is set
 *   2. DeepSeek — when DEEPSEEK_API_KEY is set
 *   3. z-ai-web-dev-sdk — sandbox default, always available
 *
 * Returns the assistant content string.
 * Throws on failure (callers catch and fall back to heuristics).
 */
export async function callLLM(messages: LLMMessage[]): Promise<{ content: string; provider: string }> {
  // Priority #1: Hugging Face (FREE) — when HUGGINGFACE_API_KEY is set
  if (isHuggingFaceConfigured()) {
    try {
      const result = await huggingfaceChat(
        messages.map((m) => ({ role: m.role as "system" | "user" | "assistant", content: m.content })),
        { temperature: 0.2 },
      );
      return { content: result.content, provider: `huggingface (${result.model})` };
    } catch (err) {
      console.warn("[ai] Hugging Face call failed, falling back:", err);
    }
  }

  // Priority #2: Gemini (highly reliable backup)
  if (isGeminiConfigured()) {
    try {
      const result = await geminiChat(messages);
      return { content: result.content, provider: `gemini (${result.model})` };
    } catch (err) {
      console.warn("[ai] Gemini call failed, falling back:", err);
    }
  }

  // Priority #2: DeepSeek
  // [DEMO MODE] DeepSeek commented out — re-enable for production
  // if (isDeepSeekConfigured()) {
  //   try {
  //     const result = await deepseekChat(
  //       messages.map((m) => ({ role: m.role as "system" | "user" | "assistant", content: m.content })),
  //       { temperature: 0.2 },
  //     );
  //     return { content: result.content, provider: `deepseek (${result.model})` };
  //   } catch (err) {
  //     console.warn("[ai] DeepSeek call failed, falling back to z-ai SDK:", err);
  //   }
  // }

  // Priority #3: z-ai-web-dev-sdk (sandbox fallback, always available)
  const zai = (await getZai()) as {
    chat: {
      completions: {
        create: (args: { messages: { role: string; content: string }[]; thinking: { type: string } }) =>
          Promise<{ choices: { message: { content?: string } }[] }>;
      };
    };
  };
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });
  return {
    content: completion.choices[0]?.message?.content ?? "",
    provider: "z-ai-web-dev-sdk",
  };
}

/** Which LLM provider is active (for display in the UI). */
export function activeLLMProvider(): string {
  if (isHuggingFaceConfigured()) {
    return `Hugging Face (${getHuggingFaceModel()}) — FREE`;
  }
  if (isGeminiConfigured()) {
    return `Gemini (${getGeminiModel()})`;
  }
  if (isDeepSeekConfigured()) {
    return "DeepSeek (deepseek-chat)";
  }
  return "z-ai-web-dev-sdk (sandbox fallback)";
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
    /hate|terrible|worst|broken|bug|crash|annoying|frustrat|useless|garbage|awful|stuck|repeat|same song|can't find|hard to find|missing|freez|laggy|paywall|expensive|ads/.test(
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

  // Map to the new theme taxonomy. More specific phrases are checked first so
  // e.g. "data loss" wins over the bare "data" keyword.
  let theme = "other";
  if (/checkout|billing|charge|refund|payment|transaction/.test(t)) theme = "payment";
  else if (/crash|freeze|slow|lag|loading|speed/.test(t)) theme = "performance";
  else if (/navigation|ui|interface|confusing|design|accessibility/.test(t)) theme = "usability";
  else if (/signup|sign up|setup|first time|tutorial|onboarding/.test(t)) theme = "onboarding";
  else if (/wish|should add|need a|feature request|missing feature/.test(t)) theme = "features";
  else if (/customer service|support|response time|help/.test(t)) theme = "support";
  else if (/expensive|price|cost|subscription|plan/.test(t)) theme = "pricing";
  else if (/privacy|security|account/.test(t)) theme = "security";
  else if (/data loss|bug|error|broken/.test(t)) theme = "reliability";
  else if (/content quality|relevance|moderation/.test(t)) theme = "content";

  let priority: Priority = "medium";
  if (bug) priority = "critical";
  else if (negative && (theme === "performance" || theme === "reliability" || theme === "payment"))
    priority = "high";
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
      ? "Reported crash/bug affects core functionality."
      : theme === "performance" || theme === "reliability"
        ? "Directly impacts core product reliability."
        : feature
          ? "Explicit feature request from a user."
          : "Signal worth tracking.",
    summary: r.text.slice(0, 120) + (r.text.length > 120 ? "…" : ""),
    keyPhrases: phrases,
    isBug: bug,
    isFeatureRequest: feature,
    isActionable:
      bug ||
      feature ||
      theme === "performance" ||
      theme === "reliability" ||
      theme === "usability" ||
      theme === "onboarding" ||
      theme === "payment",
  };
}

/**
 * Analyze a batch of reviews with the LLM. Falls back to heuristics on any error.
 * Returns one AnalysisResult per input review (order preserved).
 *
 * The LLM is asked to emit snake_case keys (review_index, sentiment_confidence,
 * sub_theme, priority_reason, key_phrases, is_bug, is_feature_request,
 * actionable). We map those back to the camelCase AnalysisResult interface
 * that the rest of the app (routes, frontend, DB) already depends on.
 */
export async function analyzeReviews(
  reviews: ReviewForAnalysis[],
): Promise<AnalysisResult[]> {
  if (reviews.length === 0) return [];
  try {
    const userContent =
      `Analyze these ${reviews.length} reviews. Return a JSON array of ${reviews.length} objects in the SAME ORDER. ` +
      `Each object's "review_index" must match the #N shown below.\n\n` +
      reviews
        .map((r, i) => `#${i + 1} [rating=${r.rating}, source=${r.source}]\n${r.text}`)
        .join("\n\n");

    const { content: raw } = await callLLM([
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);

    const arr = extractJsonArray(raw) as Array<Record<string, unknown> & Partial<AnalysisResult>>;

    // Index by review_index when present so out-of-order responses still map
    // correctly; otherwise fall back to array position.
    const byIndex = new Map<number, Record<string, unknown>>();
    for (const item of arr) {
      if (item && typeof item === "object") {
        const idx = typeof item.review_index === "number" ? item.review_index : NaN;
        if (!Number.isNaN(idx)) byIndex.set(idx, item);
      }
    }

    // Map snake_case LLM keys → camelCase AnalysisResult fields.
    const num = (v: unknown, fallback: number): number =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    const bool = (v: unknown, fallback: boolean): boolean =>
      typeof v === "boolean" ? v : fallback;
    const str = (v: unknown, fallback: string): string =>
      typeof v === "string" && v.length > 0 ? v : fallback;

    return reviews.map((r, i) => {
      const item = (byIndex.get(i + 1) || arr[i]) as
        | (Record<string, unknown> & Partial<AnalysisResult>)
        | undefined;
      if (!item || typeof item !== "object") return heuristicAnalysis(r);
      const fallback = heuristicAnalysis(r);
      return {
        sentiment: (item.sentiment as Sentiment) || fallback.sentiment,
        sentimentScore: num(item.sentiment_confidence ?? item.sentimentScore, fallback.sentimentScore),
        theme: str(item.theme, fallback.theme),
        subTheme: str(item.sub_theme ?? item.subTheme, fallback.subTheme),
        priority: (item.priority as Priority) || fallback.priority,
        priorityReason: str(item.priority_reason ?? item.priorityReason, fallback.priorityReason),
        summary: str(item.summary, fallback.summary),
        keyPhrases: Array.isArray(item.key_phrases)
          ? (item.key_phrases as unknown[]).map(String)
          : Array.isArray(item.keyPhrases)
            ? (item.keyPhrases as unknown[]).map(String)
            : fallback.keyPhrases,
        isBug: bool(item.is_bug ?? item.isBug, fallback.isBug),
        isFeatureRequest: bool(
          item.is_feature_request ?? item.isFeatureRequest,
          fallback.isFeatureRequest,
        ),
        isActionable: bool(item.actionable ?? item.isActionable, fallback.isActionable),
      };
    });
  } catch (err) {
    console.error("[ai] analyzeReviews failed, using heuristic fallback:", err);
    return reviews.map(heuristicAnalysis);
  }
}

/* ----------------------------- RAG chat ----------------------------- */

const RAG_SYSTEM_PROMPT = `You are a product analyst assistant. You answer questions about customer reviews based ONLY on the provided review context.

Rules:
- Cite specific reviews when making claims (reference review numbers like "Review #123").
- If the context doesn't contain enough information to answer confidently, say so honestly. Do not guess.
- Be concise and actionable. Product teams need clear, prioritized insights.
- Quantify when possible (e.g., "340 reviews mention this issue", "89% of payment-related reviews are negative").
- Never make up data, reviews, or statistics that aren't in the provided context.
- Structure your answer with clear headings and bullet points for readability.`;

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

/**
 * Vector-based retrieval: embed the question, compute true cosine similarity
 * against each review's stored embedding, return top-N. Falls back to the
 * keyword TF-IDF retriever when no embeddings are available for a review.
 */
export async function retrieveReviewsByVector(
  question: string,
  reviews: { id: string; text: string; author: string; source: string; rating: number }[],
  embeddingByReviewId: Map<string, number[]>,
  topN = 8,
): Promise<RagSource[]> {
  if (reviews.length === 0) return [];
  // Embed the question (neural if available, else TF-IDF).
  const { embedText, cosineSimilarity } = await import("./embeddings");
  const qVec = await embedText(question);

  const scored = reviews.map((r) => {
    const vec = embeddingByReviewId.get(r.id);
    let score = 0;
    if (vec && vec.length === qVec.length) {
      score = cosineSimilarity(qVec, vec);
    } else {
      // No embedding for this review — fall back to a token-overlap signal so
      // it can still be surfaced if highly relevant.
      score = tokenOverlap(question, r.text) * 0.5;
    }
    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0.01).slice(0, topN);
  const max = top[0]?.score || 1;
  return top.map((s) => ({
    reviewId: s.r.id,
    text: s.r.text,
    author: s.r.author,
    source: s.r.source,
    rating: s.r.rating,
    score: Math.min(1, s.score / max),
  }));
}

/** Cheap token-overlap signal (0..1), used as a fallback when no embedding. */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.sqrt(ta.size * tb.size);
}

/** Run a RAG chat turn: retrieve -> prompt -> answer. */
export async function ragChat(
  question: string,
  reviews: { id: string; text: string; author: string; source: string; rating: number }[],
  embeddingByReviewId?: Map<string, number[]>,
): Promise<RagResult> {
  // Prefer real vector similarity when embeddings are present; else keyword TF-IDF.
  const sources =
    embeddingByReviewId && embeddingByReviewId.size > 0
      ? await retrieveReviewsByVector(question, reviews, embeddingByReviewId, 8)
      : retrieveReviews(question, reviews, 8);
  let answer: string;
  if (sources.length === 0) {
    answer =
      "I couldn't find any reviews matching your question. Try asking about a specific theme like payment, performance, usability, onboarding, features, support, pricing, security, reliability, or content.";
  } else {
    const context = sources
      .map(
        (s, i) =>
          `#${i + 1} (rating=${s.rating}, source=${s.source}, author=${s.author})\n${s.text}`,
      )
      .join("\n\n");

    try {
      const { content } = await callLLM([
        { role: "system", content: RAG_SYSTEM_PROMPT },
        {
          role: "user",
          content: `CONTEXT (review excerpts, each prefixed with its review number):\n${context}\n\nQUESTION: ${question}\n\nAnswer based only on the context. Cite reviews as "Review #N" using the numbers above.`,
        },
      ]);
      answer =
        content.trim() ||
        "I couldn't generate an answer. Please try rephrasing.";
    } catch (err) {
      console.error("[ai] ragChat LLM call failed:", err);
      // Compose a transparent fallback answer from the retrieved snippets.
      const snippets = sources
        .slice(0, 4)
        .map((s, i) => `• Review #${i + 1}: "${s.text.slice(0, 140)}${s.text.length > 140 ? "…" : ""}"`)
        .join("\n");
      answer = `Based on the most relevant reviews I found:\n${snippets}\n\n(This is a keyword-retrieval fallback because the language model was unavailable.)`;
    }
  }
  return { answer, sources };
}
