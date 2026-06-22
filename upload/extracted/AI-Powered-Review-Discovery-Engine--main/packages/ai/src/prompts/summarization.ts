export function buildSummaryPrompt(data: {
  theme: string;
  reviews: string[];
  sentimentDist: { positive: number; negative: number; neutral: number; mixed: number };
  dateRange: string;
  totalReviews: number;
}): string {
  const reviewsText = data.reviews.map((text, i) => `${i + 1}. "${text}"`).join('\n');

  return `You are summarizing a cluster of ${data.totalReviews} customer reviews about "${data.theme}" from the period ${data.dateRange}.

Sentiment distribution:
- Positive: ${data.sentimentDist.positive}
- Negative: ${data.sentimentDist.negative}
- Neutral: ${data.sentimentDist.neutral}
- Mixed: ${data.sentimentDist.mixed}

Representative reviews:
${reviewsText}

Produce a structured summary in this JSON format:
{
  "theme": "${data.theme}",
  "period": "${data.dateRange}",
  "total_reviews": ${data.totalReviews},
  "sentiment_distribution": { "positive": ${data.sentimentDist.positive}, "negative": ${data.sentimentDist.negative}, "neutral": ${data.sentimentDist.neutral}, "mixed": ${data.sentimentDist.mixed} },
  "executive_summary": "<2-3 sentence overview suitable for a product leader in a weekly report>",
  "top_issues": [
    {
      "issue": "<specific problem description>",
      "frequency": "<how often mentioned, e.g., '47 reviews', 'most common complaint'>",
      "example_quotes": ["<exact quote from a review>", "<another quote>"],
      "recommended_action": "<concrete next step for the product team>"
    }
  ],
  "trend": "improving" | "worsening" | "stable",
  "trend_evidence": "<brief reasoning for the trend assessment>"
}`;
}
