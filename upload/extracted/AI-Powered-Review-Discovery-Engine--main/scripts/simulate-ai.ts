import { db, reviews, insights, activityLog } from '../packages/database/src/index.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const PM_THEMES = ['content', 'features', 'usability', 'pricing', 'performance'] as const;
const SENTIMENTS = ['positive', 'negative', 'neutral', 'mixed'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const SUMMARIES = [
  'User is frustrated that Discover Weekly keeps playing the same 5 artists every week. They want truly new music.',
  "Complains that 'Smart Shuffle' is ruining their custom playlists by injecting songs they already skipped yesterday.",
  'User loves the UI but hates how hard it is to find emerging artists outside of the mainstream pop charts.',
  'Wants a way to block certain genres from recommendations completely.',
  'App keeps suggesting podcasts when they only want to listen to music.',
  'User created a playlist of obscure indie rock, but recommendations are just mainstream rock hits.',
  "The 'Made For You' mixes feel stale and haven't updated with new tracks in weeks.",
  "Wishes there was a 'Reset Algorithm' button because their taste changed but Spotify keeps recommending old stuff.",
  'User states the algorithm prioritizes sponsored/major label artists over organic discovery.',
  "Frustrated with repetitive listening—wants a dedicated feature for 'Songs I haven't heard in 6 months'.",
];

async function simulateAI() {
  console.log('Fetching all reviews...');
  const allReviews = await db.select().from(reviews);

  if (allReviews.length === 0) {
    console.log('No reviews to process!');
    return;
  }

  console.log(`Processing ${allReviews.length} reviews...`);

  // Group by project
  const byProject = allReviews.reduce(
    (acc, r) => {
      if (!acc[r.projectId]) acc[r.projectId] = [];
      acc[r.projectId].push(r);
      return acc;
    },
    {} as Record<string, typeof allReviews>
  );

  for (const [projectId, projectReviews] of Object.entries(byProject)) {
    console.log(`Processing ${projectReviews.length} reviews for project ${projectId}...`);
    let processed = 0;

    for (const review of projectReviews) {
      const hash = crypto
        .createHash('md5')
        .update(review.reviewText || '')
        .digest('hex');
      const hashNum = parseInt(hash.slice(0, 8), 16);

      const sentiment = hashNum % 10 < 2 ? 'positive' : hashNum % 10 < 5 ? 'mixed' : 'negative';
      const theme = PM_THEMES[hashNum % PM_THEMES.length];

      const priority =
        sentiment === 'negative' ? PRIORITIES[(hashNum % 2) + 2] : PRIORITIES[hashNum % 2];
      const isBug = theme === 'features' && hashNum % 4 === 0;
      const isFeatureRequest = theme === 'features' && hashNum % 4 === 1;

      const summary = SUMMARIES[hashNum % SUMMARIES.length];

      await db
        .update(reviews)
        .set({
          processingStatus: 'completed',
          sentiment,
          sentimentConfidence: 0.85 + (hashNum % 15) / 100,
          theme,
          subTheme: 'music_discovery',
          priority,
          priorityReason: 'User explicitly mentioned algorithm or recommendation issues',
          aiSummary: summary,
          isBug,
          isFeatureRequest,
          actionable: true,
          processedAt: new Date(),
        })
        .where(eq(reviews.id, review.id));

      processed++;
    }

    console.log(`Generating Insight Report for Project: ${projectId}`);

    const reportSummary = `
## Music Discovery Challenges: Weekly AI Report
Our AI has analyzed ${processed} recent reviews. The primary frustration is **repetitive listening behavior caused by stale recommendation algorithms**. 

**Key Findings:**
1. **The "Filter Bubble"**: 65% of negative reviews mention that Discover Weekly and Smart Shuffle aggressively recycle the same artists rather than surfacing genuinely new music.
2. **Loss of Control**: Users are frustrated they cannot "reset" their algorithm or explicitly block certain recommendations.
3. **Podcast Intrusion**: Many users trying to discover music are annoyed by UI elements prioritizing podcast recommendations.

**Actionable PM Recommendations:**
- Introduce a "Discovery Mode" toggle that explicitly deprioritizes user's historical listening data.
- Add a "Reset Algorithm" feature for users whose tastes have shifted.
- Separate Music and Podcast recommendations entirely in the UI.
    `;

    // Check if insight already exists to avoid duplicates
    const existingInsight = await db
      .select()
      .from(insights)
      .where(eq(insights.projectId, projectId));
    if (existingInsight.length === 0) {
      await db.insert(insights).values({
        projectId,
        insightType: 'weekly_summary',
        title: 'Weekly AI Review Analysis: Music Discovery',
        summary: reportSummary,
        details: {
          metrics: {
            totalReviewsAnalyzed: processed,
            topTheme: 'content',
            averageSentimentScore: -0.4,
            criticalBugs: 12,
          },
          actionableItems: [
            'Implement Algorithm Reset Button',
            'Separate Podcast UI',
            'Create Deep Discovery Playlist',
          ],
        },
        dateRangeStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        dateRangeEnd: new Date(),
      });

      await db.insert(activityLog).values({
        projectId,
        action: 'insights.generated',
        entityType: 'project',
        entityId: projectId,
        details: { type: 'weekly_summary' },
      });
    }
  }

  console.log('AI Simulation Complete!');
}

simulateAI()
  .catch(console.error)
  .finally(() => process.exit(0));
