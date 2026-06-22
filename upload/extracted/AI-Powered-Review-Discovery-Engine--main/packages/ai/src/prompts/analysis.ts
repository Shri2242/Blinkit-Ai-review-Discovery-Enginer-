export const THEME_TAXONOMY = `
Theme taxonomy (use ONLY these values):
- "payment"     — checkout, billing, transactions, refunds, charges
- "performance" — speed, crashes, loading time, freezing, lag
- "usability"   — navigation, UI confusion, accessibility, design
- "onboarding"  — signup, setup, first-time experience, tutorial
- "features"    — feature requests, missing functionality, wishlist
- "support"     — customer service experience, response time, helpfulness
- "pricing"     — cost complaints, plan confusion, value perception, subscription
- "security"    — privacy concerns, data handling, account security
- "reliability" — bugs, data loss, unexpected behavior, errors
- "content"     — content quality, relevance, moderation
- "other"       — truly unclassifiable (use sparingly)`;

export function buildAnalysisPrompt(
  reviews: Array<{
    index: number;
    text: string;
    rating?: number | null;
    title?: string | null;
  }>
): string {
  const reviewsText = reviews
    .map((r) => {
      let block = `Review ${r.index}:`;
      if (r.title) block += `\nTitle: ${r.title}`;
      if (r.rating) block += `\nRating: ${r.rating}/5`;
      block += `\nText: "${r.text}"`;
      return block;
    })
    .join('\n\n');

  return `Analyze each of the following customer reviews. For each, extract structured data.

${THEME_TAXONOMY}

Return a JSON array with one object per review, in the SAME ORDER as the input.

Each object must have this structure:
{
  "review_index": <number matching the input review number>,
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentiment_confidence": <number between 0.0 and 1.0>,
  "theme": "<one of the theme values from the taxonomy above>",
  "sub_theme": "<specific topic within the theme, e.g., 'card declined', 'app crash on startup'>",
  "priority": "critical" | "high" | "medium" | "low",
  "priority_reason": "<brief explanation of why this priority level>",
  "key_phrases": ["<important phrase 1>", "<important phrase 2>"],
  "summary": "<one sentence summary of the feedback>",
  "actionable": <true if the review contains actionable feedback, false otherwise>,
  "is_bug": <true if reporting a bug or defect>,
  "is_feature_request": <true if requesting a new feature>
}

Reviews to analyze:

${reviewsText}`;
}
