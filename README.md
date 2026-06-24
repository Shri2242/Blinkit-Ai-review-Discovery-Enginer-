# ReviewPulse — AI-Powered Review Discovery Engine

> PM Fellowship Graduation Project · June 2026
> Turn user reviews into product decisions.

## What It Does
ReviewPulse analyzes user reviews at scale using AI to surface music-discovery pain points. It answers:
- Why do users struggle to discover new music?
- What are the most common frustrations with recommendations?
- What listening behaviors are users trying to achieve?
- What causes users to repeatedly listen to the same content?
- Which user segments experience different discovery challenges?
- What unmet needs emerge consistently across reviews?

## Live Demo
- **URL:** [https://ai-review-discovery-engine.vercel.app](https://ai-review-discovery-engine.vercel.app)
- **Login:** None (demo mode — dashboard loads directly with public auth bypass)
- **Data:** Pre-loaded with 105 real-style Spotify reviews

## Features

### Review Collection (Real)
- Google Play Store reviews (`google-play-scraper`)
- Apple App Store reviews (`app-store-scraper`)
- Reddit posts (public JSON API)
- Twitter/X (Apify-ready scraper integrations)
- Manual CSV/JSON upload (supports payloads up to 5MB)

### AI Analysis
- **Hugging Face LLM (Mistral-7B-Instruct)** — FREE, no payment required (configured via free API token)
- **11-theme taxonomy**: payment, performance, usability, onboarding, features, support, pricing, security, reliability, content, other
- Sentiment classification, priority mapping, key phrases extraction, bug/feature flag detection
- Robust heuristic fallback if LLM is temporarily unavailable

### RAG Chat (Semantic Search)
- **384-dim neural embeddings** (`@xenova/transformers` running locally, $0 token cost)
- Cosine similarity retrieval computed in-process
- Answers cite real review excerpts with clickable citation chips
- Persisted chat history per project workspace

### 6-Dimension Segmentation
- Core cuts by rating bracket, source platform, sentiment, and theme
- Cross-segment heatmaps and distribution matrices (theme × rating, theme × source)

### Insights
- Top issues ranked dynamically by frequency × severity
- Emerging trends with week-over-week (WoW) growth calculations
- Priority-ranked feature requests
- Auto-generated weekly summaries

### Other Features
- Report schedules (daily, weekly, and monthly)
- Webhooks (HMAC-signed payloads with auto-disable on consecutive delivery failures)
- Saved searches and custom filters
- API Keys (SHA-256 hashed at rest)
- Activity log audit trail

---

## Tech Stack

We prioritized a **lean, self-contained architecture** that runs on free-tier services, minimizing external APIs and payment requirements:

- **Next.js 16 (App Router)** — Single codebase for frontend, API route handlers, and server routines.
- **TypeScript 5** — Strict type safety across components and endpoints.
- **Prisma ORM** — Standard database modeling (SQLite for development / PostgreSQL + pgvector for production).
- **@xenova/transformers** — Runs `all-MiniLM-L6-v2` locally inside the Next.js process for zero-cost embeddings.
- **Hugging Face Inference API** — Free LLM inference using Mistral-7B-Instruct (no credit card needed).
- **Tailwind CSS v4 + shadcn/ui** — Sleek responsive layout with HSL colors and glassmorphism details.
- **Recharts** — For render-efficient segment charts and sentiment trends.
- **Zustand** — Client state management.

### Commented / Optional Integrations
To keep the application highly lightweight and deployable out-of-the-box, heavier or paid integrations have been commented out or made optional in development:
- **DeepSeek API** (Optional paid LLM fallback)
- **Firebase Admin SDK** (Optional for phone/OAuth identity verification)
- **Google OAuth** (Optional for multi-tenant deployments)
- **Resend** (Optional email provider for team invites)
- **Twilio** (Optional SMS gateway for phone codes)
- **Redis** (Optional for production multi-instance rate limiting; local rate-limiting runs in-memory)

---

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/Shri2242/Ai-Review-Discovery-Engine.git
cd Ai-Review-Discovery-Engine
```

### 2. Install dependencies
```bash
bun install
```

### 3. Configure environment variables
Copy the template and fill in the values:
```bash
cp .env.example .env
```
*(Only `DATABASE_URL` is required for SQLite, and `HUGGINGFACE_API_KEY` for free AI analysis. Auth is bypassed automatically in local/demo workspaces).*

### 4. Initialize Database
Push the database schema and generate the Prisma Client:
```bash
bunx prisma db push
```

### 5. Start the development server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the landing page and dashboard.
