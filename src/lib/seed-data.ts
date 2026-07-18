import type { FetchedReview } from "./collectors";
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const blinkitReviews = [
  { text: "Blinkit is a lifesaver! Got my groceries in 10 minutes flat. Highly recommended.", rating: 5, source: "app_store", author: "PriyaS", sentiment: "positive", theme: "Performance" },
  { text: "My last two orders had missing items. Customer support refunded me, but it's annoying when you're cooking and missing an ingredient.", rating: 2, source: "google_play", author: "Rahul1992", sentiment: "negative", theme: "Reliability" },
  { text: "The app desperately needs a dark mode. Opening it at 11 PM to order snacks burns my eyes.", rating: 3, source: "reddit", author: "NightOwlCoder", sentiment: "mixed", theme: "Usability" },
  { text: "Fresh produce is a hit or miss. Sometimes the tomatoes are perfect, other times they're completely squished.", rating: 3, source: "twitter", author: "@foodie_delhi", sentiment: "mixed", theme: "Content" },
  { text: "Payment gateway keeps failing on UPI. Blinkit please fix this immediately!", rating: 1, source: "app_store", author: "AngryShopper", sentiment: "negative", theme: "Reliability" },
  { text: "I repeatedly buy from the same categories because the UI makes it so easy to reorder my daily essentials.", rating: 5, source: "google_play", author: "DailyBuyer", sentiment: "positive", theme: "Usability" },
  { text: "I rarely explore new categories because the search function is a bit clunky for non-grocery items like electronics.", rating: 3, source: "reddit", author: "TechGeek", sentiment: "mixed", theme: "Usability" },
  { text: "How do people discover new products? I just stick to my usuals because the app doesn't recommend anything interesting.", rating: 2, source: "twitter", author: "@habitual_buyer", sentiment: "negative", theme: "Features" },
  { text: "Habits play a huge role for me. I literally open Blinkit on autopilot every morning for milk and bread.", rating: 4, source: "app_store", author: "MorningRoutine", sentiment: "positive", theme: "Content" },
  { text: "Before trying a new category like beauty products, I need to see detailed ingredient lists, which are often missing.", rating: 3, source: "google_play", author: "SkincareJunkie", sentiment: "mixed", theme: "Content" },
  { text: "My biggest frustration that emerges repeatedly is delivery partners calling for directions when the pin is exact.", rating: 2, source: "reddit", author: "LostInGurgaon", sentiment: "negative", theme: "Support" },
  { text: "As a younger user segment, I'm more likely to experiment with new snacks if they have good pictures, but some images are broken.", rating: 4, source: "twitter", author: "@snack_tester", sentiment: "mixed", theme: "Content" },
  { text: "An unmet need that emerges consistently: we need an option to tip the rider *after* delivery, not just before.", rating: 4, source: "app_store", author: "GenerousTipper", sentiment: "positive", theme: "Features" },
  { text: "10 minutes delivery is magic. Best app on my phone.", rating: 5, source: "google_play", author: "MagicFan", sentiment: "positive", theme: "Performance" },
  { text: "I wish there was a filter for vegan products only. It takes too long to read every label.", rating: 3, source: "reddit", author: "VeganLife", sentiment: "mixed", theme: "Features" },
  { text: "Prices are slightly higher than local markets, but you pay for the convenience.", rating: 4, source: "twitter", author: "@deal_hunter", sentiment: "mixed", theme: "Pricing" },
  { text: "App crashes every time I try to apply a promo code. Please fix this bug.", rating: 1, source: "app_store", author: "BugHunter", sentiment: "negative", theme: "Reliability" },
  { text: "The new UI update is confusing. I preferred the old layout where categories were bigger.", rating: 2, source: "google_play", author: "OldIsGold", sentiment: "negative", theme: "Usability" },
  { text: "Customer service resolved my issue in 2 minutes. Very impressed!", rating: 5, source: "reddit", author: "HappyCamper", sentiment: "positive", theme: "Support" },
  { text: "Why do they show items as available if they are going to cancel them after 5 minutes?", rating: 1, source: "twitter", author: "@frustrated_mum", sentiment: "negative", theme: "Reliability" },
  { text: "Love the printout service! Saved me so much time before my meeting.", rating: 5, source: "app_store", author: "OfficeWorker", sentiment: "positive", theme: "Features" },
  { text: "The bag charges are getting ridiculous. Stop sneaking them into the final bill.", rating: 2, source: "google_play", author: "PennyPincher", sentiment: "negative", theme: "Pricing" },
  { text: "Great variety of imported snacks. Found my favorite Korean noodles here.", rating: 5, source: "reddit", author: "KpopFan", sentiment: "positive", theme: "Content" },
  { text: "Delivery guy was rude and refused to come up to my apartment.", rating: 1, source: "twitter", author: "@apartment_dweller", sentiment: "negative", theme: "Support" },
  { text: "Can we get a subscription model for free delivery? I order every day.", rating: 4, source: "app_store", author: "DailyUser", sentiment: "positive", theme: "Features" }
];

const fullReviews = [...blinkitReviews, ...blinkitReviews.map(r => ({
  ...r,
  author: r.author + "_v2",
  text: r.text.replace("Blinkit", "The app").replace("10", "15").replace("UI", "interface"),
  source: r.source === "reddit" ? "twitter" : "app_store"
}))];

export const SEED_REVIEWS = fullReviews.map((r, i) => {
  const isBug = r.sentiment === 'negative' && r.rating <= 2;
  const isFeat = r.theme === 'Features' || r.text.includes('need') || r.text.includes('wish');
  let priority = 'low';
  if (r.rating <= 2) priority = 'high';
  if (r.rating === 1) priority = 'critical';
  if (r.rating === 3) priority = 'medium';
  
  return {
    text: r.text,
    title: null,
    rating: r.rating,
    source: r.source,
    author: r.author,
    daysAgo: Math.floor(Math.random() * 14),
    sentiment: r.sentiment,
    sentimentScore: r.sentiment === 'positive' ? 0.9 : r.sentiment === 'negative' ? 0.1 : 0.5,
    theme: r.theme.toLowerCase(),
    subTheme: r.theme.toLowerCase() + "_detail",
    priority: priority,
    priorityReason: "Automated tagging based on rating and keywords",
    summary: r.text.substring(0, 40) + '...',
    keyPhrases: [],
    isBug: isBug,
    isFeatureRequest: isFeat,
    isActionable: isBug || isFeat,
  };
});

export const SEED_COLLECTOR_SOURCES = [
  {
    sourceType: "google_play",
    name: "Blinkit — Google Play Reviews",
    config: JSON.stringify({ appId: "com.grofers.customerapp", lang: "en", sort: "newest" }),
    enabled: true,
    schedule: "0 9 * * *",
    lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    lastRunStatus: "success",
    lastRunCount: 0,
    totalCollected: 15
  },
  {
    sourceType: "app_store",
    name: "Blinkit — App Store Reviews (US)",
    config: JSON.stringify({ id: "1084248054", country: "us", sort: "recent" }),
    enabled: true,
    schedule: "30 9 * * *",
    lastRunAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    lastRunStatus: "success",
    lastRunCount: 0,
    totalCollected: 15
  },
  {
    sourceType: "reddit",
    name: "r/Blinkit — Hot Posts",
    config: JSON.stringify({ subreddit: "blinkit", sort: "new" }),
    enabled: true,
    schedule: "0 */6 * * *",
    lastRunAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    lastRunStatus: "partial",
    lastRunCount: 0,
    totalCollected: 10
  },
  {
    sourceType: "twitter",
    name: "Blinkit Discovery Mentions",
    config: JSON.stringify({ query: "blinkit grocery" }),
    enabled: true,
    schedule: "0 */4 * * *",
    lastRunAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    lastRunStatus: "success",
    lastRunCount: 0,
    totalCollected: 10
  }
];

export async function seedDatabase(db: PrismaClient): Promise<{
  project: any;
  reviewsInserted: number;
  sourcesInserted: number;
  user: { id: string; email: string; name: string } | null;
}> {
  await db.activityLog.deleteMany();
  await db.webhookDelivery.deleteMany();
  await db.webhookConfig.deleteMany();
  await db.reportSchedule.deleteMany();
  await db.analyticsDaily.deleteMany();
  await db.savedSearch.deleteMany();
  await db.insight.deleteMany();
  await db.chatMessage.deleteMany();
  await db.uploadBatch.deleteMany();
  await db.apiKey.deleteMany();
  await db.reviewEmbedding.deleteMany();
  await db.collectorLog.deleteMany();
  await db.collectorSource.deleteMany();
  await db.review.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();

  const { hashPassword } = await import("./auth");
  const admin = await db.user.create({
    data: {
      email: "pm@reviewpulse.dev",
      name: "Product Manager",
      passwordHash: hashPassword("ReviewPulse123!"),
      authProvider: "email",
    },
  });

  const project = await db.project.create({
    data: {
      name: "Blinkit Review Discovery Enginer",
      description: "Growth team initiative: analyze user feedback to increase meaningful product discovery.",
      ownerId: admin.id,
      members: { create: { userId: admin.id, role: "admin" } },
    },
  });

  await db.review.createMany({
    data: SEED_REVIEWS.map((r) => ({
      projectId: project.id,
      text: r.text,
      title: r.title,
      rating: r.rating,
      reviewDate: new Date(Date.now() - r.daysAgo * MS_PER_DAY),
      source: r.source,
      author: r.author,
      contentHash: createHash("sha256").update(r.text).digest("hex"),
      processingStatus: "completed",
      processedAt: new Date(),
      sentiment: r.sentiment,
      sentimentScore: r.sentimentScore,
      theme: r.theme,
      subTheme: r.subTheme,
      priority: r.priority,
      priorityReason: r.priorityReason,
      summary: r.summary,
      keyPhrases: JSON.stringify(r.keyPhrases),
      isBug: r.isBug,
      isFeatureRequest: r.isFeatureRequest,
      isActionable: r.isActionable,
    })),
  });

  await db.collectorSource.createMany({
    data: SEED_COLLECTOR_SOURCES.map((s) => ({
      projectId: project.id,
      sourceType: s.sourceType,
      name: s.name,
      config: s.config,
      enabled: s.enabled,
      schedule: s.schedule,
      lastRunAt: s.lastRunAt,
      lastRunStatus: s.lastRunStatus,
      lastRunCount: s.lastRunCount,
      totalCollected: s.totalCollected,
    })),
  });

  return {
    project,
    reviewsInserted: SEED_REVIEWS.length,
    sourcesInserted: SEED_COLLECTOR_SOURCES.length,
    user: { id: admin.id, email: admin.email, name: admin.name },
  };
}
