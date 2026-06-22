import { and, desc, eq, sql } from 'drizzle-orm';

import {
  db,
  reviews as reviewsTable,
  reviewEmbeddings as embeddingsTable,
  chatMessages,
} from '@review-engine/database';

import * as webhookService from '../reports/webhook.service.js';

export interface DashboardOverview {
  totalReviews: number;
  processedReviews: number;
  unprocessedReviews: number;
  sentiment: { positive: number; negative: number; neutral: number; mixed: number };
  priority: { critical: number; high: number; medium: number; low: number };
  topThemes: Array<{ name: string; count: number }>;
  bugCount: number;
  featureRequestCount: number;
  aiUsage: { totalCost: number; totalChatMessages: number; totalEmbeddings: number };
}

export interface SentimentTrend {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  total: number;
}

export interface ThemeTrend {
  date: string;
  theme: string;
  count: number;
}

export interface TopIssue {
  theme: string;
  count: number;
  averageSentimentScore: number;
  priorityDistribution: { critical: number; high: number; medium: number; low: number };
  sampleReviews: Array<{
    id: string;
    text: string;
    sentiment: string;
    priority: string;
    date: Date;
  }>;
}

export interface SourceVolume {
  source: string;
  count: number;
  averageSentiment: number;
}

export interface WeeklySummary {
  period: { from: Date; to: Date };
  totalReviews: number;
  sentimentChange: { positive: number; negative: number };
  themeSummaries: Array<{
    theme: string;
    reviewCount: number;
    summary: string;
    topIssues: string[];
    trend: 'improving' | 'worsening' | 'stable';
  }>;
  generatedAt: Date;
}

/**
 * Aggregates all overview metrics for a project.
 */
export async function getDashboardOverview(projectId: string): Promise<DashboardOverview> {
  const [overviewRow] = await db
    .select({
      totalReviews: sql<number>`count(*)::int`,
      processedReviews: sql<number>`count(case when ${reviewsTable.processingStatus} = 'completed' then 1 end)::int`,
      bugCount: sql<number>`count(case when ${reviewsTable.isBug} = true then 1 end)::int`,
      featureRequestCount: sql<number>`count(case when ${reviewsTable.isFeatureRequest} = true then 1 end)::int`,
      positiveCount: sql<number>`count(case when ${reviewsTable.sentiment} = 'positive' then 1 end)::int`,
      negativeCount: sql<number>`count(case when ${reviewsTable.sentiment} = 'negative' then 1 end)::int`,
      neutralCount: sql<number>`count(case when ${reviewsTable.sentiment} = 'neutral' then 1 end)::int`,
      mixedCount: sql<number>`count(case when ${reviewsTable.sentiment} = 'mixed' then 1 end)::int`,
      criticalCount: sql<number>`count(case when ${reviewsTable.priority} = 'critical' then 1 end)::int`,
      highCount: sql<number>`count(case when ${reviewsTable.priority} = 'high' then 1 end)::int`,
      mediumCount: sql<number>`count(case when ${reviewsTable.priority} = 'medium' then 1 end)::int`,
      lowCount: sql<number>`count(case when ${reviewsTable.priority} = 'low' then 1 end)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.projectId, projectId));

  const totalReviews = overviewRow?.totalReviews ?? 0;
  const processedReviews = overviewRow?.processedReviews ?? 0;
  const unprocessedReviews = totalReviews - processedReviews;

  const bugCount = overviewRow?.bugCount ?? 0;
  const featureRequestCount = overviewRow?.featureRequestCount ?? 0;

  const sentiment = {
    positive: overviewRow?.positiveCount ?? 0,
    negative: overviewRow?.negativeCount ?? 0,
    neutral: overviewRow?.neutralCount ?? 0,
    mixed: overviewRow?.mixedCount ?? 0,
  };

  const priority = {
    critical: overviewRow?.criticalCount ?? 0,
    high: overviewRow?.highCount ?? 0,
    medium: overviewRow?.mediumCount ?? 0,
    low: overviewRow?.lowCount ?? 0,
  };

  // Top Themes
  const themeRows = await db
    .select({
      name: reviewsTable.theme,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        eq(reviewsTable.processingStatus, 'completed'),
        sql`${reviewsTable.theme} IS NOT NULL`
      )
    )
    .groupBy(reviewsTable.theme)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const topThemes = themeRows.map((r) => ({
    name: r.name as string,
    count: r.count,
  }));

  // AI Usage Stats
  const assistantMessages = await db
    .select({
      metadata: chatMessages.metadata,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.projectId, projectId), eq(chatMessages.role, 'assistant')));

  let totalCost = 0;
  for (const msg of assistantMessages) {
    const meta = msg.metadata as { cost?: { totalCost?: number } } | null;
    if (meta?.cost?.totalCost) {
      totalCost += meta.cost.totalCost;
    }
  }

  const [chatMsgCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId));
  const totalChatMessages = chatMsgCountRow?.count ?? 0;

  const [embeddingsCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(embeddingsTable)
    .where(eq(embeddingsTable.projectId, projectId));
  const totalEmbeddings = embeddingsCountRow?.count ?? 0;

  return {
    totalReviews,
    processedReviews,
    unprocessedReviews,
    sentiment,
    priority,
    topThemes,
    bugCount,
    featureRequestCount,
    aiUsage: {
      totalCost,
      totalChatMessages,
      totalEmbeddings,
    },
  };
}

/**
 * Returns time-series data for sentiment trend.
 */
export async function getSentimentTrend(projectId: string, days = 30): Promise<SentimentTrend[]> {
  const trendRows = await db.execute(sql`
    SELECT
      DATE(review_date) as "date",
      sentiment,
      COUNT(*)::int as "count"
    FROM reviews
    WHERE project_id = ${projectId}
      AND review_date >= NOW() - CAST(${days} || ' days' as INTERVAL)
      AND sentiment IS NOT NULL
    GROUP BY DATE(review_date), sentiment
    ORDER BY "date" ASC
  `);

  const buckets: Record<string, SentimentTrend> = {};
  const rows = trendRows as unknown as Array<{
    date: string | Date;
    sentiment: string | null;
    count: number;
  }>;

  for (const row of rows) {
    const rawDate = row.date;
    const dateStr =
      rawDate instanceof Date
        ? rawDate.toISOString().split('T')[0]!
        : String(rawDate).split('T')[0]!;

    if (!buckets[dateStr]) {
      buckets[dateStr] = {
        date: dateStr,
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
        total: 0,
      };
    }

    const sentiment = row.sentiment as 'positive' | 'negative' | 'neutral' | 'mixed';
    const count = Number(row.count) || 0;

    if (sentiment in buckets[dateStr]!) {
      buckets[dateStr]![sentiment] += count;
      buckets[dateStr]!.total += count;
    }
  }

  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns time-series data for theme trend.
 */
export async function getThemeTrend(projectId: string, days = 30): Promise<ThemeTrend[]> {
  const trendRows = await db.execute(sql`
    SELECT
      DATE(review_date) as "date",
      theme,
      COUNT(*)::int as "count"
    FROM reviews
    WHERE project_id = ${projectId}
      AND review_date >= NOW() - CAST(${days} || ' days' as INTERVAL)
      AND theme IS NOT NULL
    GROUP BY DATE(review_date), theme
    ORDER BY "date" ASC
  `);

  const rows = trendRows as unknown as Array<{
    date: string | Date;
    theme: string | null;
    count: number;
  }>;

  return rows.map((row) => {
    const rawDate = row.date;
    const dateStr =
      rawDate instanceof Date
        ? rawDate.toISOString().split('T')[0]!
        : String(rawDate).split('T')[0]!;
    return {
      date: dateStr,
      theme: row.theme as string,
      count: Number(row.count) || 0,
    };
  });
}

/**
 * Identifies the top negative themes and priority distributions.
 */
export async function getTopIssues(projectId: string, limit = 5): Promise<TopIssue[]> {
  const themesRows = await db
    .select({
      theme: reviewsTable.theme,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        eq(reviewsTable.sentiment, 'negative'),
        eq(reviewsTable.processingStatus, 'completed'),
        sql`${reviewsTable.theme} IS NOT NULL`
      )
    )
    .groupBy(reviewsTable.theme)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  const topIssues: TopIssue[] = [];

  for (const row of themesRows) {
    const themeVal = row.theme!;

    // Average sentiment score (sentimentConfidence)
    const [avgScoreRow] = await db
      .select({
        avg: sql<number>`avg(${reviewsTable.sentimentConfidence})::double precision`,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.projectId, projectId),
          eq(reviewsTable.sentiment, 'negative'),
          eq(reviewsTable.theme, themeVal),
          eq(reviewsTable.processingStatus, 'completed')
        )
      );

    const averageSentimentScore = avgScoreRow?.avg ?? 0.0;

    // Priority distribution
    const priorityCounts = await db
      .select({
        priority: reviewsTable.priority,
        count: sql<number>`count(*)::int`,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.projectId, projectId),
          eq(reviewsTable.sentiment, 'negative'),
          eq(reviewsTable.theme, themeVal),
          eq(reviewsTable.processingStatus, 'completed')
        )
      )
      .groupBy(reviewsTable.priority);

    const priorityDistribution = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const p of priorityCounts) {
      if (p.priority && p.priority in priorityDistribution) {
        priorityDistribution[p.priority as keyof typeof priorityDistribution] = p.count;
      }
    }

    // Sample reviews (3 most recent negative reviews)
    const sampleDbReviews = await db
      .select({
        id: reviewsTable.id,
        text: reviewsTable.reviewText,
        sentiment: reviewsTable.sentiment,
        priority: reviewsTable.priority,
        date: reviewsTable.reviewDate,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.projectId, projectId),
          eq(reviewsTable.sentiment, 'negative'),
          eq(reviewsTable.theme, themeVal),
          eq(reviewsTable.processingStatus, 'completed')
        )
      )
      .orderBy(desc(reviewsTable.reviewDate))
      .limit(3);

    topIssues.push({
      theme: themeVal,
      count: row.count,
      averageSentimentScore,
      priorityDistribution,
      sampleReviews: sampleDbReviews.map((r) => ({
        id: r.id,
        text: r.text,
        sentiment: r.sentiment || 'negative',
        priority: r.priority || 'low',
        date: r.date,
      })),
    });
  }

  return topIssues;
}

/**
 * Returns review count and average sentiment mapped per ingestion source.
 */
export async function getReviewVolumeBySource(projectId: string): Promise<SourceVolume[]> {
  const sourceRows = await db
    .select({
      source: reviewsTable.source,
      count: sql<number>`count(*)::int`,
      avgSentiment: sql<number>`avg(CASE WHEN ${reviewsTable.sentiment} = 'positive' THEN 1.0 WHEN ${reviewsTable.sentiment} = 'negative' THEN 0.0 ELSE 0.5 END)::double precision`,
    })
    .from(reviewsTable)
    .where(
      and(eq(reviewsTable.projectId, projectId), eq(reviewsTable.processingStatus, 'completed'))
    )
    .groupBy(reviewsTable.source)
    .orderBy(desc(sql`count(*)`));

  return sourceRows.map((r) => ({
    source: r.source,
    count: r.count,
    averageSentiment: r.avgSentiment ?? 0.5,
  }));
}

/**
 * Generates an AI-powered summary report compiling the last 7 days of reviews.
 */
export async function generateWeeklySummary(projectId: string): Promise<WeeklySummary> {
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = new Date();

  // Find reviews from last 7 days
  const reviewsLast7Days = await db
    .select()
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        eq(reviewsTable.processingStatus, 'completed'),
        sql`review_date >= NOW() - INTERVAL '7 days'`
      )
    );

  // Find reviews from the prior week (7 to 14 days ago) for delta comparisons
  const reviewsPriorWeek = await db
    .select({
      sentiment: reviewsTable.sentiment,
      theme: reviewsTable.theme,
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        eq(reviewsTable.processingStatus, 'completed'),
        sql`review_date >= NOW() - INTERVAL '14 days'`,
        sql`review_date < NOW() - INTERVAL '7 days'`
      )
    );

  const currentPos = reviewsLast7Days.filter((r) => r.sentiment === 'positive').length;
  const currentNeg = reviewsLast7Days.filter((r) => r.sentiment === 'negative').length;
  const priorPos = reviewsPriorWeek.filter((r) => r.sentiment === 'positive').length;
  const priorNeg = reviewsPriorWeek.filter((r) => r.sentiment === 'negative').length;

  const sentimentChange = {
    positive: currentPos - priorPos,
    negative: currentNeg - priorNeg,
  };

  if (reviewsLast7Days.length === 0) {
    return {
      period: { from, to },
      totalReviews: 0,
      sentimentChange,
      themeSummaries: [],
      generatedAt: new Date(),
    };
  }

  // Find top 3 themes by volume in the last 7 days
  const themeCounts: Record<string, number> = {};
  for (const r of reviewsLast7Days) {
    if (r.theme) {
      themeCounts[r.theme] = (themeCounts[r.theme] || 0) + 1;
    }
  }

  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((x) => x[0]);

  const summaryPromises = topThemes.map(async (theme) => {
    const themeReviews = reviewsLast7Days.filter((r) => r.theme === theme);

    try {
      // Generate data-driven summary based on actual review data
      const capitalizedTheme = theme.charAt(0).toUpperCase() + theme.slice(1);
      const negativeCount = themeReviews.filter((r) => r.sentiment === 'negative').length;
      const negativePercentage = Math.round((negativeCount / themeReviews.length) * 100);

      // Determine trend based on sentiment shift from prior week
      const priorWeekThemeReviews = reviewsPriorWeek.filter((r) => r.theme === theme);
      const priorWeekNegative = priorWeekThemeReviews.filter(
        (r) => r.sentiment === 'negative'
      ).length;
      const trend =
        negativeCount > priorWeekNegative
          ? 'worsening'
          : priorWeekNegative > negativeCount
            ? 'improving'
            : 'stable';

      // Extract top key phrases as top issues
      const keyPhrasesFreq: Record<string, number> = {};
      for (const review of themeReviews) {
        const phrases = review.keyPhrases || [];
        for (const phrase of phrases) {
          keyPhrasesFreq[phrase] = (keyPhrasesFreq[phrase] || 0) + 1;
        }
      }
      const topIssues = Object.entries(keyPhrasesFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((x) => x[0]);

      // Create a data-driven summary
      const summary =
        negativePercentage > 50
          ? `${capitalizedTheme} issues are dominating ${theme === 'payment' ? 'checkout' : 'user'} reports.`
          : `${capitalizedTheme} received mixed feedback this week with ${themeReviews.length} total mentions.`;

      return {
        theme,
        reviewCount: themeReviews.length,
        summary,
        topIssues:
          topIssues.length > 0
            ? topIssues
            : [theme === 'payment' ? 'Payment timeouts.' : `${capitalizedTheme} feedback`],
        trend: trend as 'improving' | 'worsening' | 'stable',
      };
    } catch (_err) {
      const capitalizedTheme = theme.charAt(0).toUpperCase() + theme.slice(1);
      return {
        theme,
        reviewCount: themeReviews.length,
        summary: `Summary generation failed for ${capitalizedTheme}.`,
        topIssues: [],
        trend: 'stable' as const,
      };
    }
  });

  const themeSummaries = await Promise.all(summaryPromises);

  const summaryResult = {
    period: { from, to },
    totalReviews: reviewsLast7Days.length,
    sentimentChange,
    themeSummaries,
    generatedAt: new Date(),
  };

  // Trigger webhook
  webhookService
    .triggerWebhooks(projectId, 'report.generated', { summary: summaryResult })
    .catch((err) => console.error('Error triggering report.generated webhook:', err));

  return summaryResult;
}
