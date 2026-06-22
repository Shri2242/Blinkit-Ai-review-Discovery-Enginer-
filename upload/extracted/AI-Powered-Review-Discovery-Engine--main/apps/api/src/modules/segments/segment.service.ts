import { sql } from 'drizzle-orm';

import { db } from '@review-engine/database';

class SegmentService {
  // Segment by rating bracket
  async getByRating(projectId: string) {
    const rows = await db.execute(sql`
      SELECT
        CASE
          WHEN rating <= 2 THEN 'Low (1-2)'
          WHEN rating = 3 THEN 'Mid (3)'
          WHEN rating >= 4 THEN 'High (4-5)'
          ELSE 'No Rating'
        END as segment,
        COUNT(*)::int as total,
        COUNT(CASE WHEN processing_status = 'completed' THEN 1 END)::int as analyzed,
        COUNT(CASE WHEN sentiment = 'positive' THEN 1 END)::int as positive,
        COUNT(CASE WHEN sentiment = 'negative' THEN 1 END)::int as negative,
        COUNT(CASE WHEN sentiment = 'neutral' THEN 1 END)::int as neutral,
        COUNT(CASE WHEN sentiment = 'mixed' THEN 1 END)::int as mixed,
        COUNT(CASE WHEN is_bug = true THEN 1 END)::int as bugs,
        COUNT(CASE WHEN is_feature_request = true THEN 1 END)::int as feature_requests,
        ROUND(AVG(CASE WHEN sentiment_confidence IS NOT NULL THEN sentiment_confidence END)::numeric, 3)::float as avg_confidence
      FROM reviews
      WHERE project_id = ${projectId}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows;
  }

  // Segment by source platform
  async getBySource(projectId: string) {
    const rows = await db.execute(sql`
      SELECT
        COALESCE(source::text, 'unknown') as segment,
        COUNT(*)::int as total,
        COUNT(CASE WHEN processing_status = 'completed' THEN 1 END)::int as analyzed,
        COUNT(CASE WHEN sentiment = 'positive' THEN 1 END)::int as positive,
        COUNT(CASE WHEN sentiment = 'negative' THEN 1 END)::int as negative,
        COUNT(CASE WHEN sentiment = 'neutral' THEN 1 END)::int as neutral,
        COUNT(CASE WHEN sentiment = 'mixed' THEN 1 END)::int as mixed,
        COUNT(CASE WHEN is_bug = true THEN 1 END)::int as bugs,
        COUNT(CASE WHEN is_feature_request = true THEN 1 END)::int as feature_requests,
        ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END)::numeric, 2)::float as avg_rating
      FROM reviews
      WHERE project_id = ${projectId}
      GROUP BY 1
      ORDER BY total DESC
    `);
    return rows;
  }

  // Segment by sentiment
  async getBySentiment(projectId: string) {
    const rows = await db.execute(sql`
      SELECT
        COALESCE(sentiment::text, 'unprocessed') as segment,
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_bug = true THEN 1 END)::int as bugs,
        COUNT(CASE WHEN is_feature_request = true THEN 1 END)::int as feature_requests,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END)::int as critical,
        COUNT(CASE WHEN priority = 'high' THEN 1 END)::int as high,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END)::int as medium,
        COUNT(CASE WHEN priority = 'low' THEN 1 END)::int as low,
        ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END)::numeric, 2)::float as avg_rating
      FROM reviews
      WHERE project_id = ${projectId}
      GROUP BY 1
      ORDER BY total DESC
    `);
    return rows;
  }

  // Segment by theme
  async getByTheme(projectId: string) {
    const rows = await db.execute(sql`
      SELECT
        theme as segment,
        COUNT(*)::int as total,
        COUNT(CASE WHEN sentiment = 'positive' THEN 1 END)::int as positive,
        COUNT(CASE WHEN sentiment = 'negative' THEN 1 END)::int as negative,
        COUNT(CASE WHEN sentiment = 'neutral' THEN 1 END)::int as neutral,
        COUNT(CASE WHEN sentiment = 'mixed' THEN 1 END)::int as mixed,
        COUNT(CASE WHEN is_bug = true THEN 1 END)::int as bugs,
        COUNT(CASE WHEN is_feature_request = true THEN 1 END)::int as feature_requests,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END)::int as critical,
        ROUND(AVG(CASE WHEN sentiment_confidence IS NOT NULL THEN sentiment_confidence END)::numeric, 3)::float as avg_confidence
      FROM reviews
      WHERE project_id = ${projectId} AND theme IS NOT NULL AND processing_status = 'completed'
      GROUP BY theme
      ORDER BY total DESC
      LIMIT 15
    `);
    return rows;
  }

  // Cross-segment: Theme x Rating
  async getThemeByRating(projectId: string) {
    const rows = await db.execute(sql`
      SELECT
        theme as segment,
        CASE
          WHEN rating <= 2 THEN 'low'
          WHEN rating = 3 THEN 'mid'
          WHEN rating >= 4 THEN 'high'
          ELSE 'none'
        END as rating_bracket,
        COUNT(*)::int as total,
        COUNT(CASE WHEN sentiment = 'negative' THEN 1 END)::int as negative_count
      FROM reviews
      WHERE project_id = ${projectId} AND theme IS NOT NULL AND processing_status = 'completed'
      GROUP BY theme,
        CASE
          WHEN rating <= 2 THEN 'low'
          WHEN rating = 3 THEN 'mid'
          WHEN rating >= 4 THEN 'high'
          ELSE 'none'
        END
      ORDER BY theme, rating_bracket
    `);
    return rows;
  }

  // Cross-segment: Theme x Source
  async getThemeBySource(projectId: string) {
    const rows = await db.execute(sql`
      SELECT
        theme as segment,
        COALESCE(source::text, 'unknown') as source,
        COUNT(*)::int as total,
        COUNT(CASE WHEN sentiment = 'negative' THEN 1 END)::int as negative_count,
        ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END)::numeric, 2)::float as avg_rating
      FROM reviews
      WHERE project_id = ${projectId} AND theme IS NOT NULL AND processing_status = 'completed'
      GROUP BY theme, COALESCE(source::text, 'unknown')
      ORDER BY theme, 2
    `);
    return rows;
  }

  // Summary
  async getSegmentSummary(projectId: string) {
    const [byRating, bySource, bySentiment, byTheme] = await Promise.all([
      this.getByRating(projectId),
      this.getBySource(projectId),
      this.getBySentiment(projectId),
      this.getByTheme(projectId),
    ]);
    return { byRating, bySource, bySentiment, byTheme };
  }
}

export const segmentService = new SegmentService();
