import "server-only";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "gemini-2.5-flash";

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY && GEMINI_API_KEY.length > 0;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export interface GeminiMessage {
  role: "system" | "user" | "model";
  parts: { text: string }[];
}

/**
 * Call Google Gemini API directly via HTTP fetch.
 */
export async function geminiChat(
  messages: { role: string; content: string }[],
  options: { model?: string } = {}
): Promise<{ content: string; model: string }> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = options.model || getGeminiModel();
  
  // Format messages for Gemini API
  // Gemini expects system instruction separate or inside contents.
  // In the REST API, systemInstruction is a top-level property.
  const systemMessage = messages.find(m => m.role === "system");
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  const body: any = { contents };
  if (systemMessage) {
    body.systemInstruction = {
      parts: [{ text: systemMessage.content }]
    };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  return { content, model };
}
