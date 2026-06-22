/**
 * ReviewPulse — DeepSeek API client (server-only).
 *
 * Used when DEEPSEEK_API_KEY is configured. Falls back to z-ai-web-dev-sdk
 * (the sandbox default) when the key is absent. This makes the AI layer
 * DeepSeek-native in production with zero code changes.
 *
 * Docs: https://api-docs.deepseek.com/
 */
import "server-only";

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

export function isDeepSeekConfigured(): boolean {
  return !!DEEPSEEK_API_KEY;
}

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekResult {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model: string;
  costUsd?: number;
  latencyMs: number;
}

/**
 * Call DeepSeek's chat completions endpoint.
 * @param messages - conversation messages
 * @param options - model (default deepseek-chat), temperature, maxTokens, json
 */
export async function deepseekChat(
  messages: DeepSeekMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<DeepSeekResult> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }
  const start = Date.now();
  const model = options.model || "deepseek-chat";
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
  };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.json) body.response_format = { type: "json_object" };

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const content = data.choices[0]?.message?.content ?? "";
  const latencyMs = Date.now() - start;

  // DeepSeek pricing (approx, per 1M tokens): input $0.14, output $0.28 (deepseek-chat).
  let costUsd: number | undefined;
  if (data.usage) {
    const inCost = (data.usage.prompt_tokens || 0) * 0.14 / 1_000_000;
    const outCost = (data.usage.completion_tokens || 0) * 0.28 / 1_000_000;
    costUsd = Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
  }

  return { content, usage: data.usage, model, costUsd, latencyMs };
}
