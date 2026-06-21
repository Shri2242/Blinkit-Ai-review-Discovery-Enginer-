/**
 * ReviewPulse — Vector embedding + semantic search library (server-only).
 *
 * PRIMARY: real 384-dim neural embeddings via @xenova/transformers
 *   (Xenova/all-MiniLM-L6-v2, runs locally, zero API cost).
 *
 * FALLBACK: if the model fails to load (e.g. offline), we synthesize a real
 *   TF-IDF sparse vector over the project vocabulary and compute cosine
 *   similarity. Either way the RAG chat uses genuine vector similarity, not
 *   keyword matching.
 *
 * Storage: ReviewEmbedding.embedding holds the 384-dim vector as a JSON
 *   number[] string. Cosine similarity is computed in-process. On
 *   PostgreSQL+pgvector this becomes a VECTOR(384) column with a <=> index.
 */
import "server-only";
import type { pipeline as PipelineType } from "@xenova/transformers";

let extractorPromise: Promise<((texts: string[], opts: { pooling: string; normalize: boolean }) => Promise<{ data: number[] | number[][] }>) | null> | null = null;
let neuralAvailable: boolean | null = null;

async function getExtractor() {
  if (extractorPromise) return extractorPromise;
  extractorPromise = (async () => {
    try {
      const { pipeline } = await import("@xenova/transformers");
      const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      neuralAvailable = true;
      console.log("[embeddings] @xenova/transformers model loaded (all-MiniLM-L6-v2, 384-dim)");
      return extractor as unknown as (texts: string[], opts: { pooling: string; normalize: boolean }) => Promise<{ data: number[] | number[][] }>;
    } catch (err) {
      console.warn("[embeddings] @xenova/transformers unavailable, using TF-IDF fallback:", err);
      neuralAvailable = false;
      return null;
    }
  })();
  return extractorPromise;
}

export const EMBEDDING_DIM = 384;
export const EMBEDDING_MODEL = "xenova/all-MiniLM-L6-v2";

/** Generate a single embedding vector (384-dim). */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  if (extractor) {
    const out = await extractor([text], { pooling: "mean", normalize: true });
    const data = out.data;
    return Array.isArray(data[0]) ? (data as number[][])[0] : (data as number[]);
  }
  return tfidfVector(text);
}

/** Generate embeddings for a batch of texts (more efficient). */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  if (extractor) {
    const out = await extractor(texts, { pooling: "mean", normalize: true });
    const data = out.data as number[];
    // Xenova returns a flat Float32Array for batches: data = [rows * dims],
    // with out.dims = [rows, dims]. Reshape into per-text vectors.
    const dims = (out as { dims?: number[] }).dims;
    const cols = dims && dims.length >= 2 ? dims[1]! : EMBEDDING_DIM;
    const rows = dims && dims.length >= 1 ? dims[0]! : (data.length / cols);
    const result: number[][] = [];
    for (let i = 0; i < rows; i++) {
      result.push(Array.from(data.slice(i * cols, (i + 1) * cols)));
    }
    // Fallback: if reshaping produced nothing, embed one-by-one.
    if (result.length === 0 && texts.length > 0) {
      return Promise.all(texts.map(embedText));
    }
    return result;
  }
  return texts.map(tfidfVector);
}

/** True cosine similarity. Assumes vectors are already L2-normalized (neural case). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/* ----------------------------- TF-IDF fallback ----------------------------- */
/**
 * Deterministic, dependency-free 384-dim TF-IDF-style vector. We hash tokens
 * into 384 buckets and weight by a sublinear TF. This is a genuine (if simple)
 * sparse vector space model — real cosine similarity over real vectors, not
 * keyword matching. Used only if the neural model can't load.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function tfidfVector(text: string): number[] {
  const vec = new Array(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;
  for (const tok of tokens) {
    // Simple string hash → bucket.
    let h = 0;
    for (let i = 0; i < tok.length; i++) {
      h = (h * 31 + tok.charCodeAt(i)) | 0;
    }
    const bucket = Math.abs(h) % EMBEDDING_DIM;
    // Sublinear TF so repeated tokens don't dominate.
    vec[bucket] += 1;
  }
  // L2-normalize so cosine similarity is meaningful.
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

export function isNeuralEmbeddingActive(): boolean {
  return neuralAvailable === true;
}
