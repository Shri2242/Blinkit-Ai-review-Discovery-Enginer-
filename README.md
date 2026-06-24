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

### Commented / Optional Integrations (For Future Use)
To keep the deployment zero-cost and self-contained, the following enterprise integrations are currently bypassed or disabled, but can be enabled in production by configuring their environment variables:

```bash
# -- OPTIONAL AI PROVIDER --
# DEEPSEEK_API_KEY=your_key_here         # Paid DeepSeek LLM API key
# DEEPSEEK_BASE_URL=https://api.deepseek.com

# -- OPTIONAL AUTHENTICATION & IDENTITY --
# GOOGLE_CLIENT_ID=your_id_here         # For Google OAuth Sign-in
# GOOGLE_CLIENT_SECRET=your_secret_here
# FIREBASE_PROJECT_ID=your_id_here       # For phone verification & user profiles
# FIREBASE_SERVICE_ACCOUNT=your_json_here

# -- OPTIONAL COMMUNICATORS --
# RESEND_API_KEY=your_key_here           # For automated email verification/invites
# RESEND_FROM_EMAIL=noreply@yourdomain.com
# TWILIO_ACCOUNT_SID=your_sid_here       # For SMS OTP verification
# TWILIO_AUTH_TOKEN=your_token_here
# TWILIO_PHONE_NUMBER=your_number_here

# -- OPTIONAL INFRASTRUCTURE --
# REDIS_URL=redis://localhost:6379       # For production distributed rate limiting
# DATABASE_URL=postgresql://...          # Migrates from SQLite to Postgres + pgvector
```

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

---

## Production Deployment (Neon Postgres)

The project is pre-configured for direct deployment to **Neon Postgres** on **Vercel**. 

### 1. Database Connection & Schema Migration
- The database connection is loaded dynamically from the `DATABASE_URL` environment variable. **Do not hardcode connection strings** in the codebase.
- During Vercel build time, the database tables are automatically provisioned and synchronized using the local **Prisma v6 client** via:
  ```bash
  npx prisma generate && npx prisma db push --accept-data-loss
  ```
- This build-time hook is declared in `vercel.json` and `package.json` to ensure the Neon database is always in sync with your schema prior to cold start.

### 2. First-Run UI Database Bootstrapping
- If your Neon database starts completely empty (with `0` projects), the live website will automatically display a **Database Initialization** onboarding screen.
- Click **"Initialize Demo Database"** directly in the browser to bootstrap the database with a default admin user (`pm@reviewpulse.dev`), a demo Spotify workspace, and the 105 sample reviews.

### 3. Vercel Hobby Plan Deployment Guard (Git Commits)
If you deploy this project to Vercel on a **Hobby Plan**, Vercel blocks deployments if it detects commit authors with unrecognized email addresses (treating them as unauthorized private collaborators). 

To ensure Vercel builds your commits without blocks, configure Git locally in this repository to use your GitHub no-reply email before committing:
```bash
# Configure git locally in the project directory
git config user.name "Your Name"
git config user.email "username@users.noreply.github.com"
```
*(For example, if your GitHub username is `Shri2242`, set the email to `shri2242@users.noreply.github.com`)*.

If your deployment is blocked due to an old commit with an incorrect email, squash your recent commits and rewrite the author:
```bash
git commit --amend --reset-author --no-edit
git push origin main --force
```

### 4. Automated Daily Scheduler & API Security
- **Secure Machine-to-Machine Auth:** The `/api/collect`, `/api/analyze`, and `/api/embed` routes are secured using a service-account Bearer token check. Configure your `API_AUTH_TOKEN` in Vercel and GitHub Secrets, and it will authenticate automatically as `Service Account` with full access to target your default demo project workspace (`Spotify — Music Discovery`).
- **Hobby-tier Timeout Prevention:** Vercel Hobby plan has a strict 10-second serverless execution limit. By default, collecting reviews will try to run LLM analysis and embeddings synchronously. To prevent timeouts, the cron pipeline runs `/api/collect` with `"skipAutoProcess": true`, making it return instantly. The subsequent analysis and embedding updates are executed sequentially in isolated, batched steps (`/api/analyze` and `/api/embed`).

---

## Strategy: How to Enable Optional Features

If you want to configure additional enterprise features in your production environment:

### 1. Enabling pgvector (Optional)
Currently, `ReviewEmbedding` stores vectors as JSON Strings to maintain compile-time compatibility. To migrate to native pgvector:
1. Run the script `prisma/add-pgvector.sql` in your Postgres console to enable the `vector` extension.
2. In `prisma/schema.prisma`, update the `ReviewEmbedding` model:
   ```prisma
   model ReviewEmbedding {
     // ...
     embedding Unsupported("VECTOR(384)")? // Use native pgvector instead of String JSON
     // ...
   }
   ```

### 2. Switching to DeepSeek LLM (Paid)
If you prefer to run analysis and RAG with DeepSeek instead of the free Hugging Face API:
1. Provide `DEEPSEEK_API_KEY` and optionally override `DEEPSEEK_BASE_URL` in your `.env`.
2. The core AI wrapper in `src/lib/ai.ts` will automatically detect the presence of the key and route queries through DeepSeek instead of Hugging Face.

### 3. Enabling Authentication Providers
* **Google OAuth**: Register an application in Google Cloud Console, configure redirect URIs to `${YOUR_URL}/api/auth/google/callback`, and add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`.
* **Phone Verification**: Set up a Firebase Project, retrieve service account credentials, and populate `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT` (escaped JSON string).

### 4. Activating Communications (Email & SMS)
* **SMS Verification**: Sign up for Twilio and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`.
* **Email Team Invites**: Sign up for Resend and set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. The system will automatically stop creating passwordless stub users and start sending invitation emails with sign-up links.

### 5. Setting up Distributed Rate Limiting
The middleware rate limiter operates in-memory. If deploying multiple app instances behind a load balancer, provide `REDIS_URL` in `.env`. The rate-limiting logic will automatically connect to your Redis instance to synchronize rate-limits across all app instances.


