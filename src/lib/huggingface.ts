/**
 * ReviewPulse — Hugging Face Inference API client (server-only).
 *
 * Modified to bypass local DNS firewall block by using the new OpenAI-compatible
 * Hugging Face router domain (https://router.huggingface.co/v1).
 *
 * Default model: Qwen/Qwen2.5-Coder-32B-Instruct (fully free chat model)
 */
import "server-only";

const HF_ROUTER_BASE = "https://router.huggingface.co/v1";
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const DEFAULT_MODEL = "Qwen/Qwen2.5-Coder-32B-Instruct";

export function isHuggingFaceConfigured(): boolean {
  return !!HUGGINGFACE_API_KEY && HUGGINGFACE_API_KEY.length > 0;
}

export function getHuggingFaceModel(): string {
  return process.env.HUGGINGFACE_MODEL || DEFAULT_MODEL;
}

export interface HuggingFaceMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface HuggingFaceResult {
  content: string;
  model: string;
  latencyMs: number;
}

/**
 * Call Hugging Face OpenAI-compatible Serverless Inference API.
 * Bypasses the blocked api-inference subdomain.
 *
 * @param messages - conversation messages
 * @param options  - model, maxTokens, temperature
 */
export async function huggingfaceChat(
  messages: HuggingFaceMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {},
): Promise<HuggingFaceResult> {
  if (!HUGGINGFACE_API_KEY) {
    throw new Error("HUGGINGFACE_API_KEY is not configured.");
  }

  const model = options.model || getHuggingFaceModel();
  const start = Date.now();

  const body = {
    model: model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.2,
  };

  const res = await fetch(`${HF_ROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Hugging Face API ${res.status} for model "${model}": ${text.slice(0, 300)}`,
    );
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, model, latencyMs: Date.now() - start };
}
