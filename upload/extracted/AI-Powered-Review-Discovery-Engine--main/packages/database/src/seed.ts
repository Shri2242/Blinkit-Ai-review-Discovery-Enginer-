// ─────────────────────────────────────────────────────────────────────────────
// Seed script — Populates development database with demo data
// ─────────────────────────────────────────────────────────────────────────────
// Usage: pnpm db:seed

import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { sql } from 'drizzle-orm';

import { loadEnv } from './env-loader.js';
import { users, projects, reviews, projectMembers, insights } from './schema/index.js';

// Pool of realistic reviewer names
const authors = [
  'Emma Watson',
  'James Smith',
  'Lucas Miller',
  'Sophia Brown',
  'Oliver Jones',
  'Mia Davis',
  'Ethan Garcia',
  'Charlotte Rodriguez',
  'Liam Martinez',
  'Amelia Hernandez',
  'Noah Lopez',
  'Harper Gonzalez',
  'Jack Wilson',
  'Evelyn Anderson',
  'Alexander Thomas',
  'Aria Taylor',
  'Benjamin Moore',
  'Ella Martin',
  'Henry Jackson',
  'Chloe Lee',
  'Samuel Wright',
  'Grace Scott',
  'David Martinez',
  'Victoria Taylor',
  'Daniel Robinson',
];

// Rich, realistic templates per theme
const templates: Record<string, string[]> = {
  payment: [
    'Payment failed during checkout. Tried 3 different cards.',
    "Can't complete my purchase. The checkout button doesn't work.",
    'Got charged twice for the same order. Very frustrating.',
    'Card declined every time even though I have sufficient funds.',
    'Refund has been pending for 2 weeks now. When will I get my money back?',
    "Checkout page is loading infinitely and doesn't process payments.",
    'It says my billing address is incorrect, but it is 100% correct.',
    "The app charged me but the order didn't go through. Please refund.",
    'No option to pay with PayPal or Apple Pay, only standard credit card.',
    'Why did the subscription auto-renew without any email notification?',
    'The promotion code is valid but the checkout refuses to apply the discount.',
    "Tried checking out and got a generic error code 500. Support doesn't know why.",
  ],
  performance: [
    'App crashes every time I try to open my profile.',
    'Loading takes forever. I stare at a blank screen for 10+ seconds.',
    'The app freezes whenever I scroll through the product list.',
    'Takes ages to load images. Other apps are much faster.',
    'Extremely laggy interface on my device. Scrolling is painful.',
    'High CPU usage makes my phone get hot within 5 minutes of use.',
    'App crashes on startup since the last update. Completely broken.',
    'Battery drains super fast when running this app in the background.',
    'Laggy transitions when clicking between dashboard and transaction list.',
    'The search query takes over 15 seconds to return any results.',
    'Constant buffering when trying to view transaction receipts.',
    'Memory leak? The app becomes slower and slower the longer it stays open.',
  ],
  usability: [
    'Cannot find the settings page. The navigation is so confusing.',
    "Back button doesn't work properly. It exits the app instead of going back.",
    'Font is too small to read. No accessibility options available.',
    'The checkout flow has too many steps. Make it simpler.',
    'Hard to understand how to link my bank account. Instructions are unclear.',
    'The interface is too cluttered. Too many buttons on the home screen.',
    'Touch targets are too small. I keep clicking the wrong items.',
    'Dark mode has terrible contrast. Text is barely readable.',
    'The app does not support landscape orientation on my iPad.',
    'Search filters are hard to use. Cannot filter by price easily.',
    "Confusing terminology. What does 'pending settlement' mean here?",
    'The layout is broken on smaller screen sizes. Text overlaps.',
  ],
  features: [
    'Wish there was a way to export transaction history to CSV or PDF.',
    'Needs a dark mode. The white screen is blinding at night.',
    'Please add support for face recognition / biometric login.',
    'Would love to have a search bar for previous transactions.',
    'No widget support. I want to see my balance on the home screen.',
    'Can you add a split bill feature? It would be very useful.',
    'Missing integration with major budget tracking apps.',
    'Needs push notifications when a transfer is received.',
    'Would be great to customize the color themes of the dashboard.',
    'Please allow us to link multiple bank accounts, not just one.',
    'Need a way to cancel a scheduled transaction directly from the app.',
    'Add support for multiple currencies, it is essential for travel.',
  ],
  support: [
    'Live chat support is always offline. Nobody answers my tickets.',
    "Got an automated response that didn't resolve my issue at all.",
    'The customer service agent was rude and unhelpful. Disappointed.',
    'Waited 3 days for a simple reply regarding my locked account.',
    'Support page is hidden deep in settings. Hard to find contact info.',
    'No phone support option. Typing out long issues is annoying.',
    'They closed my support ticket without actually fixing my problem.',
    'Support was helpful and resolved my query quickly. Thank you.',
    'Great customer service, agent resolved my billing error immediately.',
    'Help section articles are outdated. None of the steps match the new app.',
    'The chatbot is useless. Keeps looping the same basic answers.',
  ],
  pricing: [
    'The monthly subscription is too expensive compared to competitors.',
    'Hidden fees for every transfer. This was not mentioned anywhere.',
    'Used to be free, now everything is locked behind a paywall.',
    'Pricing tier changes are unfair. They removed features from the basic plan.',
    'A 50% price increase without notice is unacceptable. Cancelling.',
    'The pricing is reasonable for the value provided. Satisfied.',
    'Wish they offered a yearly plan with a discount instead of monthly.',
    'Not worth the premium cost. Basic features should be free.',
    'Charges are not transparent. I have no idea what this fee is for.',
    'The student discount is too hard to verify. Keeps rejecting my ID.',
  ],
  onboarding: [
    'Verification code SMS never arrived. Cannot complete registration.',
    'Sign up process is too long. Why do you need my passport photo?',
    'Onboarding tutorial cannot be skipped. Extremely annoying.',
    'The app crashed during the initial setup flow. Had to restart.',
    'Seamless onboarding. Was up and running in less than 2 minutes.',
    'Easy signup process, very intuitive walkthrough at the start.',
    'The password requirements are too strict and confusing.',
    'Got stuck in an infinite loop during the bank verification step.',
    "The onboarding email went to spam, support didn't reply for days.",
    'Very smooth setup. Linked my cards without any friction.',
  ],
  reliability: [
    'App is down again. Get connection timeout errors every time.',
    'Frequent server connection drops. Very unstable connection.',
    'App works fine on Wi-Fi but fails completely on cellular data.',
    'The app logs me out every time I close it. Very annoying.',
    'Extremely reliable. Has never failed me when I needed to pay.',
    'Servers are down for maintenance too often during peak hours.',
    'Unstable balance displays. Sometimes it shows $0, then updates.',
    "App keeps saying 'Offline' even though my internet is working.",
    "Transactions get stuck in 'processing' state for hours.",
    'The sync is broken. Laptop app shows different data from mobile.',
  ],
  security: [
    'Concerned about privacy. The app requests too many permissions.',
    'No two-factor authentication option. This is unsafe for finance.',
    'Two-factor authentication code takes 10 minutes to arrive. Useless.',
    'Feels very secure with biometric lock and automatic timeout.',
    'I noticed unauthorized login attempts. Security team was responsive.',
    'Why does the app require location access just to view my profile?',
    'No notification when logging in from a new device. Big security risk.',
    "App doesn't mask my password or account number when typing.",
    'Very robust security protocols. Feels safe using it for large sums.',
    'The security questions are too easy to guess. Need better options.',
  ],
  content: [
    'Typographical errors in the main menu. Looks unprofessional.',
    'Spanish translation is terrible. Looks like a bad Google Translate job.',
    'The UI language is mixed. Some pages are in French, others English.',
    'Help documentation is poorly written and full of grammar mistakes.',
    "The app description in the store doesn't match the actual features.",
    'No localization support. I need German, but only English is available.',
    'Text instructions are too long and wordy. Need simpler summaries.',
    'Important notices are hard to read due to poor color choices.',
    'Some links in the terms of service document lead to 404 pages.',
    'The transaction category labels are confusing and overlap in meaning.',
  ],
};

// Mixed language review samples
const foreignReviews = {
  es: [
    {
      text: 'El botón de pago no funciona. Intente varias tarjetas.',
      theme: 'payment',
      sentiment: 'negative',
    },
    {
      text: 'Esta aplicación es muy lenta y se cierra sola.',
      theme: 'performance',
      sentiment: 'negative',
    },
    {
      text: 'Me encanta la interfaz de usuario, muy limpia.',
      theme: 'usability',
      sentiment: 'positive',
    },
    {
      text: 'Excelente servicio al cliente, resolvieron rápido.',
      theme: 'support',
      sentiment: 'positive',
    },
  ],
  fr: [
    {
      text: 'Le paiement a échoué pendant le passage en caisse.',
      theme: 'payment',
      sentiment: 'negative',
    },
    {
      text: "L'application plante à chaque démarrage de session.",
      theme: 'performance',
      sentiment: 'negative',
    },
    {
      text: 'Interface utilisateur très propre et intuitive.',
      theme: 'usability',
      sentiment: 'positive',
    },
    {
      text: "Bonne application dans l'ensemble pour mes comptes.",
      theme: 'features',
      sentiment: 'positive',
    },
  ],
  de: [
    {
      text: 'Zahlung fehlgeschlagen beim Checkout. Bitte prüfen.',
      theme: 'payment',
      sentiment: 'negative',
    },
    {
      text: 'Die App stürzt ständig ab nach dem Update.',
      theme: 'performance',
      sentiment: 'negative',
    },
    {
      text: 'Sehr einfache und klare Navigation in der App.',
      theme: 'usability',
      sentiment: 'positive',
    },
    {
      text: 'Hervorragender Support, Problem in 5 Minuten gelöst.',
      theme: 'support',
      sentiment: 'positive',
    },
  ],
} as const;

async function seed() {
  loadEnv();
  // Dynamically import db to ensure loadEnv runs first
  const { db } = await import('./client.js');

  console.warn('🌱 Starting database seed script...');

  // a) Connect to the database using the DATABASE_URL from environment (handled by client.ts / db)
  // b) Clear all existing data (cascade handles dependencies correctly)
  console.warn('🧹 Clearing existing database tables (cascading truncation)...');
  await db.execute(
    sql`TRUNCATE TABLE activity_log, chat_messages, chat_sessions, insights, analytics_daily, saved_searches, reviews, upload_batches, project_members, projects, users CASCADE;`
  );

  // c) Create demo users
  console.warn('👤 Hashing passwords and creating demo users...');
  const passwordHash = await bcrypt.hash('Demo@12345', 12);

  const [admin] = await db
    .insert(users)
    .values({
      email: 'admin@demo.com',
      name: 'Demo Admin',
      role: 'admin',
      passwordHash,
      isActive: true,
    })
    .returning();

  const [analyst] = await db
    .insert(users)
    .values({
      email: 'analyst@demo.com',
      name: 'Demo Analyst',
      role: 'analyst',
      passwordHash,
      isActive: true,
    })
    .returning();

  const [viewer] = await db
    .insert(users)
    .values({
      email: 'viewer@demo.com',
      name: 'Demo Viewer',
      role: 'viewer',
      passwordHash,
      isActive: true,
    })
    .returning();

  if (!admin || !analyst || !viewer) {
    throw new Error('Failed to seed users.');
  }

  // d) Create 2 demo projects with rules in settings
  console.warn('📁 Creating demo projects...');
  const firstProjectAlertRules = [
    { name: 'Critical Sentiment Drop', type: 'sentiment_drop', active: true },
    { name: 'Payment Issues Spike', type: 'theme_spike', theme: 'payment', active: true },
    { name: 'High Priority Volume', type: 'severity_threshold', active: true },
    { name: 'New Bug Clusters', type: 'new_cluster', active: false },
    { name: 'Rating Decline', type: 'sentiment_drop', active: false },
  ];

  const [payFlow] = await db
    .insert(projects)
    .values({
      name: 'PayFlow - Mobile Wallet',
      description: 'Fintech mobile wallet for peer-to-peer transfers and bill payments.',
      ownerId: admin.id,
      settings: { alertRules: firstProjectAlertRules },
    })
    .returning();

  const [shopQuick] = await db
    .insert(projects)
    .values({
      name: 'ShopQuick - E-commerce App',
      description: 'Retail e-commerce marketplace for fast checkout and delivery tracking.',
      ownerId: admin.id,
      settings: {},
    })
    .returning();

  if (!payFlow || !shopQuick) {
    throw new Error('Failed to seed projects.');
  }

  // Link members
  await db.insert(projectMembers).values([
    { projectId: payFlow.id, userId: admin.id, role: 'admin' },
    { projectId: payFlow.id, userId: analyst.id, role: 'analyst' },
    { projectId: shopQuick.id, userId: admin.id, role: 'admin' },
    { projectId: shopQuick.id, userId: analyst.id, role: 'analyst' },
  ]);

  // e) Project sources (App Store, Google Play, CSV Upload configs) are handled via reviews.source

  // f) Generate 500 reviews total (250 per project)
  console.warn('✍️ Generating 500 reviews with realistic distribution...');
  const reviewRecords: Array<typeof reviews.$inferInsert> = [];

  const projectIds = [payFlow.id, shopQuick.id];

  for (const projectId of projectIds) {
    for (let i = 0; i < 250; i++) {
      // 1. Determine Language (95% English, 5% Spanish/French/German)
      const langRoll = Math.random();
      let language = 'en';
      let text = '';
      let theme = 'usability';
      let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';

      if (langRoll > 0.95) {
        // Mixed language
        const languages = ['es', 'fr', 'de'] as const;
        const selectedLang = languages[Math.floor(Math.random() * languages.length)]!;
        language = selectedLang;
        const options = foreignReviews[selectedLang];
        const selected = options[Math.floor(Math.random() * options.length)]!;
        text = selected.text;
        theme = selected.theme;
        sentiment = selected.sentiment;
      } else {
        // English
        language = 'en';

        // Roll Sentiment: 40% positive, 30% negative, 20% neutral, 10% mixed
        const sentRoll = Math.random();
        if (sentRoll < 0.4) {
          sentiment = 'positive';
        } else if (sentRoll < 0.7) {
          sentiment = 'negative';
        } else if (sentRoll < 0.9) {
          sentiment = 'neutral';
        } else {
          sentiment = 'mixed';
        }

        // Roll Theme: payment (20%), performance (15%), usability (15%), features (15%), support (10%), pricing (10%), onboarding (5%), reliability (5%), security (3%), content (2%)
        const themeRoll = Math.random();
        if (themeRoll < 0.2) {
          theme = 'payment';
        } else if (themeRoll < 0.35) {
          theme = 'performance';
        } else if (themeRoll < 0.5) {
          theme = 'usability';
        } else if (themeRoll < 0.65) {
          theme = 'features';
        } else if (themeRoll < 0.75) {
          theme = 'support';
        } else if (themeRoll < 0.85) {
          theme = 'pricing';
        } else if (themeRoll < 0.9) {
          theme = 'onboarding';
        } else if (themeRoll < 0.95) {
          theme = 'reliability';
        } else if (themeRoll < 0.98) {
          theme = 'security';
        } else {
          theme = 'content';
        }

        // Pick theme template
        const themeTemplates = templates[theme]!;
        text = themeTemplates[Math.floor(Math.random() * themeTemplates.length)]!;
      }

      // Add a sample index prefix to guarantee text uniqueness and contentHash consistency
      const reviewText = `[Sample #${projectId.substring(0, 4)}-${i}] ${text}`;

      // Roll Rating: weighted toward 4-5 stars for positive, 1-2 for negative, 3-4 for neutral/mixed
      let rating = 3;
      const rateRoll = Math.random();
      if (sentiment === 'positive') {
        rating = rateRoll < 0.7 ? 5 : 4;
      } else if (sentiment === 'negative') {
        rating = rateRoll < 0.7 ? 1 : 2;
      } else {
        rating = rateRoll < 0.6 ? 3 : 4;
      }

      // Roll Source: 60% csv_upload, 25% app_store, 15% google_play
      const srcRoll = Math.random();
      let source: 'csv_upload' | 'app_store' | 'google_play' = 'csv_upload';
      if (srcRoll < 0.6) {
        source = 'csv_upload';
      } else if (srcRoll < 0.85) {
        source = 'app_store';
      } else {
        source = 'google_play';
      }

      // Spread dates: last 90 days with more recent dates having higher density
      const daysAgo = 90 * Math.pow(Math.random(), 1.8);
      const reviewDate = new Date();
      reviewDate.setTime(reviewDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // Compute content_hash as SHA-256 of (review_text + source + review_date)
      const dateStr = reviewDate.toISOString();
      const contentHashInput = `${reviewText}|${source}|${dateStr}`;
      const contentHash = crypto.createHash('sha256').update(contentHashInput).digest('hex');

      const authorName = authors[Math.floor(Math.random() * authors.length)]!;
      const sourceReviewId = `rev-${projectId.substring(0, 4)}-${i}`;

      reviewRecords.push({
        projectId,
        source,
        sourceReviewId,
        reviewText,
        reviewTitle: `User Review ${i + 1}`,
        rating,
        authorName,
        reviewDate,
        language,
        contentHash,
        metadata: {
          appVersion: `2.${Math.floor(Math.random() * 4)}.${Math.floor(Math.random() * 10)}`,
          deviceModel: Math.random() > 0.5 ? 'iPhone 15' : 'Samsung S24',
        },
        // Processing status pending, but sentiment and theme are pre-seeded to satisfy verification distributions
        processingStatus: 'pending',
        processedAt: null,
        processingError: null,
        retryCount: 0,
        sentiment: sentiment,
        sentimentConfidence: null,
        theme: theme as typeof reviews.$inferInsert.theme,
        subTheme: null,
        priority: null,
        priorityReason: null,
        keyPhrases: null,
        aiSummary: null,
        isBug: false,
        isFeatureRequest: false,
        actionable: false,
        embeddingId: null,
      });
    }
  }

  // Bulk insert in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < reviewRecords.length; i += chunkSize) {
    const chunk = reviewRecords.slice(i, i + chunkSize);
    await db.insert(reviews).values(chunk);
  }

  // h) Create 3 sample insights for the first project in database
  console.warn('💡 Creating 3 sample insights for PayFlow project...');
  await db.insert(insights).values([
    {
      projectId: payFlow.id,
      insightType: 'theme_summary',
      theme: 'payment',
      title: 'Payment Processing Friction Spike',
      summary:
        'Checkout issues spiked in frequency. Multiple users report checkout buttons unresponsive or transaction failures with code 500 when paying.',
      severity: 'critical',
      reviewCount: 45,
      isRead: false,
      isDismissed: false,
    },
    {
      projectId: payFlow.id,
      insightType: 'trend_alert',
      theme: 'performance',
      title: 'Trend Alert: App Crash Spike on iOS 17',
      summary:
        'Startup crashes have increased by 15% over the past 48 hours, primarily affecting users running iOS 17.1.',
      severity: 'high',
      reviewCount: 28,
      isRead: false,
      isDismissed: false,
    },
    {
      projectId: payFlow.id,
      insightType: 'weekly_report',
      title: 'Weekly Feedback Summary Digest',
      summary:
        'Overall sentiment is stable at 65% positive. Top complaints are Payment Checkout (22%) and loading speeds (15%).',
      severity: 'medium',
      reviewCount: 145,
      isRead: false,
      isDismissed: false,
    },
  ]);

  // i) Log progress
  console.warn('Seeded 3 users, 2 projects, 500 reviews, 5 alert rules, 3 insights');
}

seed()
  .then(() => {
    console.warn('✅ Seeding complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
