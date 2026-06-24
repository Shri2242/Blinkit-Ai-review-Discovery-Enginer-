/**
 * ReviewPulse — Hugging Face Inference API client (server-only).
 *
 * Used when HUGGINGFACE_API_KEY is configured. Provides FREE LLM inference
 * via Hugging Face's Inference API with no payment required.
 *
 * Get your free token at: https://huggingface.co/settings/tokens
 *
 * Default model: mistralai/Mistral-7B-Instruct-v0.3
 * Prompt format: Mistral instruction format (<s>[INST]...[/INST])
 *
 * Docs: https://huggingface.co/docs/api-inference/
 */
import "server-only";

const HF_API_BASE = "https://api-inference.huggingface.co/models";
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const DEFAULT_MODEL = "mistralai/Mistral-7B-Instruct-v0.3";

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
 * Format messages into Mistral instruction format.
 * Mistral models use: <s>[INST] {user} [/INST] {assistant}</s> [INST] {next_user} [/INST]
 * System messages are prepended to the first user message.
 */
function formatMistralPrompt(messages: HuggingFaceMessage[]): string {
  const parts: string[] = [];
  let systemPrompt = "";

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;

    if (msg.role === "system") {
      systemPrompt = msg.content;
      continue;
    }

    if (msg.role === "user") {
      const userContent = systemPrompt
        ? `${systemPrompt}\n\n${msg.content}`
        : msg.content;
      // Clear system prompt after it has been prepended once
      systemPrompt = "";

      // Look ahead for assistant response
      const nextMsg = messages[i + 1];
      if (nextMsg && nextMsg.role === "assistant") {
        parts.push(`<s>[INST] ${userContent} [/INST] ${nextMsg.content}</s>`);
        i++; // skip the assistant message, it has been consumed
      } else {
        parts.push(`<s>[INST] ${userContent} [/INST]`);
      }
    }
  }

  return parts.join(" ");
}

/** Sleep helper for retry logic. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Hugging Face Inference API with Mistral instruction format.
 *
 * Handles 503 (model loading) with up to 2 retries (5s delay each).
 * Extracts generated_text from the HF response array.
 *
 * @param messages - conversation messages (system, user, assistant)
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
  const prompt = formatMistralPrompt(messages);
  const start = Date.now();

  const body = {
    inputs: prompt,
    parameters: {
      max_new_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.2,
      return_full_text: false,
      do_sample: true,
    },
  };

  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 5000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${HF_API_BASE}/${model}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    // 503 means the model is loading — wait and retry
    if (res.status === 503 && attempt < MAX_RETRIES) {
      const retryAfterHeader = res.headers.get("X-Wait-For-Model");
      const waitMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : RETRY_DELAY_MS;
      console.warn(
        `[huggingface] Model ${model} is loading (503). Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`,
      );
      await sleep(waitMs || RETRY_DELAY_MS);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Hugging Face API ${res.status} for model "${model}": ${text.slice(0, 300)}`,
      );
    }

    // HF returns an array: [{ generated_text: "..." }]
    const data = (await res.json()) as
      | { generated_text?: string }[]
      | { error?: string };

    if (Array.isArray(data)) {
      const raw = data[0]?.generated_text ?? "";
      // Strip the prompt from the response if return_full_text was true
      const content = raw.startsWith(prompt)
        ? raw.slice(prompt.length).trim()
        : raw.trim();
      return { content, model, latencyMs: Date.now() - start };
    }

    // Error object returned
    const errMsg =
      (data as { error?: string }).error ?? "Unknown error from Hugging Face API";
    throw new Error(`Hugging Face API error: ${errMsg}`);
  }

  throw new Error(
    `Hugging Face API: Model "${model}" failed to load after ${MAX_RETRIES} retries.`,
  );
}
