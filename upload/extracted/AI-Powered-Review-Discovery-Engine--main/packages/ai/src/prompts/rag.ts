export const RAG_SYSTEM_PROMPT = `You are a product analyst assistant. You answer questions about customer reviews based ONLY on the provided review context.

Rules:
- Cite specific reviews when making claims (reference review numbers like "Review #123").
- If the context doesn't contain enough information to answer confidently, say so honestly. Do not guess.
- Be concise and actionable. Product teams need clear, prioritized insights.
- Quantify when possible (e.g., "340 reviews mention this issue", "89% of payment-related reviews are negative").
- Never make up data, reviews, or statistics that aren't in the provided context.
- Structure your answer with clear headings and bullet points for readability.`;

export function buildRagPrompt(
  question: string,
  context: {
    reviews: Array<{
      id: string;
      text: string;
      sentiment: string;
      theme: string;
      rating: number;
      date: string;
    }>;
    stats: {
      totalRetrieved: number;
      sentimentBreakdown: Record<string, number>;
      themes: Record<string, number>;
    };
  }
): string {
  const reviewsText = context.reviews
    .map((r) => `[${r.id}] (${r.sentiment}, ${r.theme}, ${r.rating}★, ${r.date}): "${r.text}"`)
    .join('\n');

  return `Context from customer reviews:

Total reviews retrieved: ${context.stats.totalRetrieved}
Sentiment breakdown: ${JSON.stringify(context.stats.sentimentBreakdown)}
Theme distribution: ${JSON.stringify(context.stats.themes)}

Retrieved reviews:
${reviewsText}

Question: ${question}`;
}
export const RAG_USER_PROMPT = buildRagPrompt;
