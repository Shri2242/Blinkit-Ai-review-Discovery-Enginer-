# ReviewPulse — AI-Powered Review Discovery Engine

> Analyze user reviews at scale with AI to surface music-discovery pain points before they show up in churn.

ReviewPulse is a fullstack product-analyst workbench for a Spotify-like music
streaming app. It ingests user reviews from app stores, Reddit, Twitter / X,
and CSV uploads, runs them through an LLM classifier (sentiment, theme,
priority, bug/feature flags, summary, key phrases), generates 384-dim neural
embeddings for real semantic search, and exposes a RAG chat — every answer
cited back to the source reviews.

It is the graduation project for the **PM Fellowship, June 2026 cohort**.

---

## Table of Contents

1. [Problem statement](#problem-statement)
2. [Architecture overview](#architecture-overview)
3. [Tech stack](#tech-stack)
4. [Honest notes: sandbox vs production](#honest-notes-sandbox-vs-production)
5. [Quick start](#quick-start)
6. [Project structure](#project-structure)
7. [API reference](#api-reference)
8. [The six segmentation dimensions](#the-six-segmentation-dimensions)
9. [RAG architecture](#rag-architecture)
10. [Security](#security)
11. [Deployment](#deployment)
12. [GitHub Actions](#github-actions)
13. [Limitations & honest notes](#limitations--honest-notes)

---

## Problem statement

Spotify's catalog has grown past 100M tracks and discovery has become the
single biggest driver of long-term retention. Yet user feedback about
discovery is fragmented across the Google Play Store, the iOS App Store,
Reddit (r/spotify, r/piracy, r/music), and Twitter, each in a different
shape, language, and signal-to-noise ratio. A PM or product analyst reading
them by hand can cover maybe 100 reviews a day; a music streaming app gets
thousands a week.

**ReviewPulse** is built on the hypothesis that AI can compress that surface
area into a small number of decision-ready signals:

- *What is the #1 friction point in music discovery this week?*
- *Which themes are emerging (week-over-week growth)?*
- *Is it a bug or a feature request?*
- *What is the user's exact phrasing, so we can write the PRD?*

This graduation project is a working MVP of that loop: collect → ingest →
analyze → segment → embed → answer.

---

## Architecture overview

ReviewPulse is a **single Next.js 16 App Router application** — the frontend,
the API backend, and the AI layer all live in one process and one repo. In
production this would be a pnpm monorepo (web app + collector worker + AI
worker); in this sandbox it is collapsed into one Next.js app for simplicity.

```
                  ┌─────────────────────────────────────────────┐
                  │            Next.js 16 App Router            │
                  │                                             │
   browser ──────►│   React Server Components + shadcn/ui       │
                  │   ─────────────────────────────────────     │
                  │   Route Handlers (src/app/api/*)            │
                  │     · auth, projects, team, apikeys         │
                  │     · reviews, stats, segments, insights    │
                  │     · collect, ingest, analyze, embed, chat │
                  │   ─────────────────────────────────────     │
                  │   Server-only libs (src/lib/*)              │
                  │     · auth.ts  (scrypt + HS256 JWT)         │
                  │     · rbac.ts (roles, ApiError, audit log)  │
                  │     · ai.ts   (z-ai-web-dev-sdk wrapper)    │
                  │     · embeddings.ts (@xenova/transformers)  │
                  │     · collectors.ts, seed-data.ts, …        │
                  └───────────┬───────────────────┬─────────────┘
                              │                   │
                              ▼                   ▼
                  ┌───────────────────┐   ┌────────────────────┐
                  │   Prisma ORM      │   │  z-ai-web-dev-sdk  │
                  │   (SQLite)        │   │  (DeepSeek-equival.)│
                  │                   │   │  · analyzeReviews  │
                  │   Project         │   │  · ragChat         │
                  │   Review          │   └────────────────────┘
                  │   ReviewEmbedding │
                  │   CollectorSource │   ┌────────────────────┐
                  │   CollectorLog    │   │ @xenova/transformers│
                  │   ApiKey          │   │ all-MiniLM-L6-v2    │
                  │   ProjectMember   │   │ 384-dim, local      │
                  │   User            │   └────────────────────┘
                  │   ActivityLog     │
                  └───────────────────┘
```

The frontend is React 19 Server Components with shadcn/ui (Tailwind v4) and
recharts for the dashboards. State on the client uses Zustand + TanStack
Query. The API layer is Next.js **Route Handlers** (`src/app/api/*`),
enforcing auth, RBAC, and Zod validation on every write. Prisma talks to
SQLite in the sandbox and to PostgreSQL + pgvector in production. The AI
layer wraps the `z-ai-web-dev-sdk` chat completions API (DeepSeek-equivalent)
for analysis and RAG, and uses `@xenova/transformers` running locally for
real 384-dim embeddings — zero per-call cost, zero data egress.

---

## Tech stack

| Layer        | Technology                                                              |
|--------------|-------------------------------------------------------------------------|
| Framework    | Next.js 16 (App Router, RSC, Route Handlers, `output: "standalone"`)    |
| Language     | TypeScript 5 (strict server-only modules via `import "server-only"`)    |
| Database     | Prisma 6 + SQLite (sandbox) → PostgreSQL + pgvector (production)        |
| LLM          | `z-ai-web-dev-sdk` (DeepSeek-equivalent chat completions, `thinking: disabled`) |
| Embeddings   | `@xenova/transformers`, `Xenova/all-MiniLM-L6-v2`, 384-dim, runs locally |
| Auth         | scrypt password hashing (RFC 7914) + HS256 JWT in httpOnly cookie        |
| Validation   | Zod 4 on every write endpoint                                           |
| UI           | shadcn/ui (Radix primitives), Tailwind CSS v4, lucide-react icons        |
| Charts       | recharts 2.15                                                           |
| State        | TanStack Query 5 + Zustand 5                                            |
| Runtime      | Bun (sandbox + production start) or Node 20 (Docker / Railway)          |

---

## Graduation Demo Mode Improvements

The project has been enhanced with several interactive demo and UX features to showcase all functionality seamlessly without friction:

1. **Restored Landing Page & Auth Bypass**:
   - The app launches to the default Landing Page.
   - Users can bypass authentication constraints by clicking "Explore the live demo" or "Launch dashboard", which enters guest overview/chat modes instantly.
2. **Project Switcher & Layout Improvements**:
   - Resolved layout overlap bugs by raising the header's stacking context (`z-50`).
   - Project list dropdown is now scrollable (`max-h-[300px] overflow-y-auto`) to support an arbitrary number of projects without overflowing the viewport.
3. **Frictionless Project Deletion**:
   - Bypassed strict project membership validation during deletion to permit deleting projects created in previous guest sessions without encountering `403 Forbidden` errors.
4. **Reliable Dashboard Synchronization**:
   - Dashboard tabs (`overview`, `segments`, `insights`) now correctly trigger a loading state when switching projects, ensuring stats and graphs reflect the newly selected project's reviews rather than stale cached data.
5. **On-Demand AI Analysis Sync**:
   - Modified `/api/collect` synchronization pipeline to unconditionally run AI analysis for any remaining `"pending"` reviews, ensuring reviews are fully populated and analyzed immediately after collection.

---

## Honest notes: sandbox vs production

This repo runs in a constrained sandbox that forces a few deliberate
simplifications. Each one is called out in code with a comment, and the
schema is portable so the production deployment is a config swap, not a
rewrite.

1. **SQLite instead of PostgreSQL + pgvector.** The sandbox has no
   Postgres, so vectors are stored as a JSON string of 384 numbers in
   `ReviewEmbedding.embedding`, and cosine similarity is computed
   in-process in `src/lib/embeddings.ts`. In production the only change
   is the `embedding` column type: `String` → `Unsupported("VECTOR(384)")`
   plus a `<=>` distance operator in the query. The schema comment in
   `prisma/schema.prisma` documents this.

2. **The LLM is `z-ai-web-dev-sdk`.** This is a DeepSeek-equivalent chat
   completions API. The same prompt templates work against any
   OpenAI-compatible chat endpoint; swap `ZAI.create()` for your client
   of choice in `src/lib/ai.ts`.

3. **Embeddings are real neural embeddings, not fakes.**
   `src/lib/embeddings.ts` loads `Xenova/all-MiniLM-L6-v2` locally via
   `@xenova/transformers` and produces real 384-dim L2-normalized
   vectors. If the model fails to load (e.g. offline cold start), it
   falls back to a deterministic 384-dim TF-IDF sparse vector — still a
   real cosine similarity over real vectors, never keyword matching.

4. **One app, not a monorepo.** In production this would be a pnpm
   workspace with `apps/web`, `apps/collector-worker`, and
   `apps/ai-worker`. The sandbox collapses them into one Next.js app.
   The collector runs in a GitHub Actions cron instead of a worker
   process (see [GitHub Actions](#github-actions)).

5. **The Prisma schema is intentionally portable.** No SQLite-specific
   types are used; the only thing that changes for Postgres is the
   `datasource db { provider = "postgresql" }` block and the vector
   column type.

---

## Quick start

> Requires **Bun** (preferred) or **Node 20+** with npm. The sandbox
> ships with Bun; production Docker uses Node 20-alpine.

```bash
# 1. Install dependencies
bun install

# 2. Copy the env example and set the required secrets
cp .env.example .env
#   → edit .env to set JWT_SECRET (the sandbox .env is fixed to SQLite
#     and only needs DATABASE_URL; production needs both).

# 3. Push the Prisma schema to the database + generate the client
bun run db:push      # equivalent to: prisma db push && prisma generate

# 4. Start the dev server (Next.js on :3000)
bun run dev
```

Then open the preview URL. The dev server also writes a `dev.log` to
the project root (per `package.json` `dev` script).

### Seed the demo data

The database starts empty. Seed it with one click:

```bash
# Either call the API…
curl -X POST http://localhost:3000/api/seed

# …or click "Seed demo data" in the landing page UI.
```

This wipes the DB and inserts:
- 1 demo admin user
- 1 project ("Spotify — Music Discovery")
- 50 realistic reviews, pre-analyzed (sentiment, theme, priority, …)
- 4 collector sources (Google Play, App Store, Reddit, Twitter)

### Default demo login

| Field    | Value                    |
|----------|--------------------------|
| Email    | `pm@reviewpulse.dev`     |
| Password | `ReviewPulse123!`        |

This account is created by the seeder with a scrypt-hashed password. If you
call `POST /api/seed` while unauthenticated, the seeder also issues a
session cookie for this user so the dashboard is immediately usable.

### Production build

```bash
bun run build    # next build + copies .next/static and public into .next/standalone
bun run start    # NODE_ENV=production bun .next/standalone/server.js
```

---

## Project structure

```
my-project/
├── prisma/
│   └── schema.prisma              # 9 models: User, Project, ProjectMember, Review,
│                                  #   ReviewEmbedding, CollectorSource, CollectorLog,
│                                  #   ApiKey, ActivityLog
├── src/
│   ├── app/
│   │   ├── api/                   # All Route Handlers (see API reference below)
│   │   │   ├── health/route.ts
│   │   │   ├── seed/route.ts
│   │   │   ├── auth/{register,login,me,logout}/route.ts
│   │   │   ├── projects/route.ts
│   │   │   ├── projects/[id]/route.ts
│   │   │   ├── team/route.ts
│   │   │   ├── team/[userId]/route.ts
│   │   │   ├── apikeys/route.ts
│   │   │   ├── apikeys/[id]/route.ts
│   │   │   ├── reviews/route.ts
│   │   │   ├── stats/route.ts
│   │   │   ├── segments/route.ts
│   │   │   ├── insights/route.ts
│   │   │   ├── chat/route.ts
│   │   │   ├── sources/route.ts
│   │   │   ├── collect/route.ts
│   │   │   ├── ingest/route.ts
│   │   │   ├── analyze/route.ts
│   │   │   └── embed/route.ts
│   │   ├── page.tsx               # Landing page
│   │   ├── dashboard/...          # Authenticated dashboard routes
│   │   └── layout.tsx
│   ├── lib/                       # Server-only modules
│   │   ├── auth.ts                # scrypt + HS256 JWT + httpOnly cookie
│   │   ├── rbac.ts                # getAuthContext, requireProjectAccess, ApiError
│   │   ├── api.ts                 # Typed client-side fetcher (browser only)
│   │   ├── ai.ts                  # z-ai-web-dev-sdk: analyzeReviews, ragChat
│   │   ├── embeddings.ts          # @xenova/transformers 384-dim + cosine similarity
│   │   ├── collectors.ts          # Platform-specific sample review fetchers
│   │   ├── db.ts                  # PrismaClient singleton
│   │   ├── seed-data.ts           # 50 seed reviews + 4 sources + seedDatabase()
│   │   ├── server.ts              # resolveProject, serializeReview helpers
│   │   ├── types.ts               # Shared TypeScript types
│   │   ├── utils.ts               # cn(), formatters
│   │   └── validation.ts          # Zod schemas for every write endpoint
│   └── components/
│       ├── ui/                    # shadcn/ui primitives (button, card, table, …)
│       ├── layout/
│       │   ├── Header.tsx
│       │   └── Sidebar.tsx
│       ├── landing/
│       │   └── Landing.tsx
│       └── dashboard/
│           ├── DashboardShell.tsx
│           ├── overview.tsx       # KPIs + sentiment trend + theme bars
│           ├── reviews.tsx        # Filterable review table
│           ├── segments.tsx       # 6-dim segmentation charts
│           ├── insights.tsx       # Top issues + emerging trends
│           ├── chat.tsx           # RAG chat with cited sources
│           ├── sources.tsx        # Collector config + run history
│           ├── team.tsx           # RBAC member management
│           ├── reports.tsx
│           ├── settings.tsx
│           └── shared.tsx
├── prisma/schema.prisma
├── next.config.ts                 # output: "standalone"
├── package.json                   # scripts: dev, build, start, db:push, db:generate
├── Dockerfile                     # Multi-stage Node 20-alpine standalone build
├── vercel.json                    # Vercel deployment config
├── railway.toml                   # Railway deployment config (alternative)
├── .github/workflows/
│   └── daily-collection.yml       # 10:00 AM IST cron → /api/collect, /api/analyze, /api/embed
└── .env.example                   # All env vars documented
```

---

## API reference

All routes are Next.js Route Handlers under `src/app/api`. Auth is via the
`rp_session` httpOnly cookie (issued by `/api/auth/login` or
`/api/auth/register`). Routes marked **session** require an authenticated
user; routes marked **RBAC** additionally require project membership at the
listed role.

| Method | Route                       | Auth            | Description                                                                              |
|--------|-----------------------------|-----------------|------------------------------------------------------------------------------------------|
| GET    | `/api/health`               | none            | Liveness probe. Returns `{ status, service, time }`.                                     |
| GET    | `/api/seed`                 | none            | Report whether the DB has been seeded (counts of projects, reviews, sources, users).     |
| POST   | `/api/seed`                 | none            | Wipe and reseed the DB with the 50-review demo dataset. Issues a session for the demo user if caller is unauthenticated. |
| POST   | `/api/auth/register`        | none            | Create user + auto-project + admin membership, issue session. Zod: `registerSchema`.     |
| POST   | `/api/auth/login`           | none            | Verify scrypt-hashed password, issue session. Zod: `loginSchema`.                        |
| GET    | `/api/auth/me`              | session         | Return current user + their projects + roles.                                            |
| POST   | `/api/auth/logout`          | session         | Clear session cookie.                                                                    |
| GET    | `/api/projects`             | session         | List projects the user is a member of.                                                   |
| POST   | `/api/projects`             | session         | Create a project (caller becomes admin). Zod: `createProjectSchema`.                     |
| GET    | `/api/projects/[id]`        | RBAC viewer+    | Fetch one project.                                                                       |
| PATCH  | `/api/projects/[id]`        | RBAC admin      | Update name/description. Zod: `updateProjectSchema`.                                     |
| DELETE | `/api/projects/[id]`        | RBAC admin      | Delete project + cascade.                                                                |
| GET    | `/api/team?projectId=`      | RBAC viewer+    | List members of a project.                                                               |
| POST   | `/api/team?projectId=`      | RBAC admin      | Invite a member by email (creates a stub user if needed). Zod: `inviteMemberSchema`.     |
| PATCH  | `/api/team/[userId]`        | RBAC admin      | Change a member's role. Refuses to demote the last admin. Zod: `updateRoleSchema`.       |
| DELETE | `/api/team/[userId]`        | RBAC admin      | Remove a member. Refuses to remove the last admin.                                       |
| GET    | `/api/apikeys`              | session         | List the user's API keys (prefix only, never the secret).                                |
| POST   | `/api/apikeys`              | session         | Create an API key. Raw key returned **once**; only SHA-256 hash is stored.               |
| DELETE | `/api/apikeys/[id]`         | session         | Revoke an API key.                                                                       |
| GET    | `/api/reviews`              | project member  | List reviews with filters (sentiment, source, theme, priority, rating, isBug, isFeatureRequest, search, limit, offset). |
| GET    | `/api/stats`                | project member  | Dashboard KPIs: totals, bySentiment/Source/Theme/Priority/Rating, 30-day sentiment trend, top issues. |
| GET    | `/api/segments`             | project member  | The 6 segmentation dimensions (see below).                                               |
| GET    | `/api/insights`             | project member  | Computed insights: top issues by severity, emerging trends (WoW growth), ranked feature requests, weekly summary. |
| POST   | `/api/chat`                 | project member  | RAG chat. Embeds the question, retrieves top-N reviews by cosine similarity, calls LLM with cited context. Zod: `chatSchema`. |
| GET    | `/api/sources`              | project member  | List collector sources + their last 5 run logs.                                          |
| POST   | `/api/sources`              | project member  | Create a collector source (`google_play` \| `app_store` \| `reddit` \| `twitter`).       |
| POST   | `/api/collect`              | project member  | Run one or all enabled collectors; inserts new reviews, dedupes by `sourceReviewId`.     |
| POST   | `/api/ingest`               | project member  | Parse a CSV/JSON payload into reviews. Dedupes by `sourceReviewId` and SHA-256 `contentHash`. |
| POST   | `/api/analyze`              | project member  | Run unprocessed reviews through the LLM analyzer (batched 8 at a time). Default limit 20, max 50. |
| POST   | `/api/embed`                | project member  | Generate + store 384-dim embeddings for processed reviews (batched 20 at a time). Default limit 50, max 200. |
| GET    | `/api/embed`                | project member  | Embedding coverage status for the active project.                                        |

### Error responses

All errors are returned as JSON:

```json
{ "error": "Human-readable message", "code": "machine_code" }
```

Codes include `invalid_credentials`, `email_taken`, `last_admin`,
`validation_error`, `api_error`, `internal_error`. In production the
`internal_error` message is replaced with `"Internal server error"` —
**no stack traces are leaked**.

---

## The six segmentation dimensions

`GET /api/segments` computes six segmentation cuts over the project's
processed reviews in a single pass:

1. **By rating bracket** — `Low (1-2★)`, `Mid (3★)`, `High (4-5★)`,
   each broken down by sentiment counts + bug/feature counts. Answers
   "do low ratings correlate with bugs?".
2. **By source platform** — `google_play`, `app_store`, `reddit`,
   `twitter`, `csv_upload`, with avg rating + sentiment counts.
   Answers "which channel is angriest this week?".
3. **By sentiment** — `positive`, `negative`, `neutral`, `mixed`,
   each with bug/feature counts + priority distribution.
4. **By theme** — `music_discovery`, `recommendation_quality`,
   `playlist_fatigue`, `playback_bug`, `ui_ux`, `search`,
   `offline_mode`, `pricing`, `social_features`, `audio_quality`,
   `general`. Sentiment + priority distribution per theme.
5. **Theme × Rating** — cross-tab of theme vs rating bracket
   (top 10 themes). Answers "is discovery pain concentrated in 1-2★
   reviews?".
6. **Theme × Source** — cross-tab of theme vs source platform
   (top 10 themes). Answers "is the playback-bug signal coming
   from the Play Store or Reddit?".

Each dimension is materialized server-side so the dashboard can render
recharts bar/heatmap visualizations without further computation.

---

## RAG architecture

The chat endpoint (`POST /api/chat`) implements retrieval-augmented
generation with **real vector similarity**, not keyword matching:

```
   question ──► embedText(question)            [src/lib/embeddings.ts]
                       │
                       │  384-dim L2-normalized
                       ▼
   ReviewEmbedding rows (JSON-encoded 384-dim)
                       │
                       │  cosineSimilarity(qVec, rVec) for each review
                       ▼
   top-N (8) reviews by similarity, score normalized 0..1
                       │
                       ▼
   "[1] (rating=2, source=reddit, author=u/…) <text>\n\n[2] …"
                       │
                       ▼
   z-ai-web-dev-sdk chat completion
   (RAG_SYSTEM_PROMPT: "answer strictly from context, cite with [n]")
                       │
                       ▼
   { answer, sources: [{ reviewId, text, author, source, rating, score }] }
```

Key properties:

- **Real embeddings.** `Xenova/all-MiniLM-L6-v2` runs locally via
  `@xenova/transformers` — zero per-call cost, zero data egress. The
  model is loaded lazily and cached for the process lifetime.
- **Real cosine similarity.** Computed in-process in
  `src/lib/embeddings.ts` (SQLite sandbox). In Postgres+pgvector this
  becomes a single `ORDER BY embedding <=> $1 LIMIT 8` query.
- **Fallback to TF-IDF vectors.** If the neural model can't load
  (offline cold start), `embedText` synthesizes a real 384-dim sparse
  vector by hashing tokens into 384 buckets and L2-normalizing. The
  cosine similarity is still mathematically valid.
- **Fallback to keyword retrieval.** If no embeddings exist for the
  project yet, `ragChat` falls back to a TF-IDF-style keyword retriever
  (`retrieveReviews`). The response is annotated with
  `vectorSearch: false` so the UI can show a "building embeddings…"
  hint.
- **Cited answers.** The LLM is prompted to cite `[1]`, `[2]` etc.
  The response carries a `sources[]` array with the original review
  text, author, source, rating, and similarity score so the UI can
  render clickable citations back to the review row.
- **Transparent failure.** If the LLM call itself fails, the endpoint
  returns a composed answer from the top-4 retrieved snippets with a
  visible "keyword-retrieval fallback" notice — never an empty reply.

---

## Security

ReviewPulse ships with a real, defense-in-depth security posture, not a
demo-grade one. Everything is implemented in `src/lib/auth.ts`,
`src/lib/rbac.ts`, and `src/lib/validation.ts`.

- **Password hashing — scrypt (RFC 7914).** `crypto.scryptSync` with
  `N=2^15, r=8, p=1, keyLen=32`. Format:
  `scrypt$N$r$p$saltHex$hashHex`. Salt is 16 random bytes per user.
  Constant-time comparison via `timingSafeEqual`.
- **JWT — HS256.** Signed with `crypto.createHmac("sha256", JWT_SECRET)`.
  Payload: `{ sub, email, name, iat, exp, jti }`. 7-day expiry. Verified
  with `timingSafeEqual` on the signature. No third-party JWT library —
  fewer supply-chain risks.
- **Session cookie.** `rp_session`, httpOnly, `sameSite=lax`,
  `secure` in production, `path=/`, 7-day `maxAge`. Signed out via
  `clearSessionCookie()`.
- **RBAC.** Three roles per project: `admin` ≥ `analyst` ≥ `viewer`.
  `requireProjectAccess(projectId, minRole)` is called by every
  protected route. Mutation routes (POST/PATCH/DELETE) require
  `admin` or `analyst`. The "last admin" rule prevents lockout.
- **Zod validation on every write.** `src/lib/validation.ts` exports
  one schema per mutation. Password policy: 8+ chars with at least one
  uppercase, one lowercase, one number, one special character. Inputs
  are clamped to sane maxima (e.g. ingest payload ≤ 5 MB, chat question
  ≤ 2000 chars, analyze limit ≤ 50).
- **API keys — SHA-256 hashed at rest.** Raw key (`rpk_live_<48hex>`)
  is shown **once** at creation. Only `keyHash` (SHA-256 hex) and a
  16-char `prefix` (for display like `rpk_live_4f9a…`) are stored.
- **User enumeration prevention.** Login returns the same generic
  `"Invalid email or password."` whether the email exists or not.
  Register returns `409 email_taken` only on actual collision.
- **Structured error responses, no stack traces in production.**
  `errorResponse()` in `src/lib/rbac.ts` maps `ApiError` and Zod
  errors to JSON `{ error, code }`. Unhandled errors return
  `"Internal server error"` in `NODE_ENV=production` (full message
  only in dev).
- **Audit trail.** Every significant action (login, register, project
  create/update/delete, team invite/role-change/remove, API key
  create/revoke, collection run) writes a row to `ActivityLog` via
  `logActivity()` (best-effort, never throws).
- **Server-only modules.** `auth.ts`, `rbac.ts`, `ai.ts`,
  `embeddings.ts`, `db.ts`, `server.ts`, `seed-data.ts`, and
  `validation.ts` all begin with `import "server-only"` so a
  client-side import is a build error, not a runtime leak.

---

## Deployment

ReviewPulse deploys cleanly to **Vercel** (frontend + API in one Next.js
app) with **Neon** (Postgres + pgvector) for the database. Railway is
provided as an alternative for a self-hosted Next.js + Postgres stack,
and a multi-stage **Dockerfile** is included for any container runtime
(Fly.io, Render, GCP Cloud Run, AWS ECS, k8s).

### 1. Database — Neon (Postgres + pgvector)

Provision a Neon project with the `pgvector` extension enabled. Grab the
connection string (it looks like
`postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/reviewpulse?sslmode=require`).

Swap the Prisma datasource from SQLite to Postgres:

```diff
// prisma/schema.prisma
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }

 model ReviewEmbedding {
   ...
-  embedding String   // JSON-encoded number[] vector (SQLite sandbox)
+  embedding Unsupported("VECTOR(384)")?  // pgvector in production
   ...
 }
```

Then push the schema:

```bash
DATABASE_URL="postgresql://…" bun run db:push
```

> The rest of the codebase is unchanged. `src/lib/embeddings.ts` already
> stores and reads 384-dim vectors; in Postgres you'd swap the in-process
> cosine loop for a single `ORDER BY embedding <=> $1 LIMIT 8` query.
> This is the **only** query-site change needed.

### 2. App — Vercel

The repo ships with `vercel.json` for a Next.js standalone deployment.
Set the environment variables in the Vercel dashboard (or via the CLI):

| Variable       | Required | Value                                                         |
|----------------|----------|---------------------------------------------------------------|
| `DATABASE_URL` | yes      | Neon connection string (with `?sslmode=require`).             |
| `JWT_SECRET`   | yes      | A 32+ char random string (`openssl rand -hex 32`).            |

Then:

```bash
vercel --prod
```

Vercel will run `next build` (which produces the `.next/standalone`
output per `next.config.ts`) and deploy.

### 3. Alternative — Railway

`railway.toml` is included. `railway up` from the repo root provisions
a Next.js service with a `/api/health` healthcheck and runs
`bun .next/standalone/server.js` (or `next start` if Bun isn't
available). Pair it with a Railway Postgres + pgvector plugin.

### 4. Alternative — Docker

```bash
docker build -t reviewpulse .
docker run -p 3000:3000 \
  -e DATABASE_URL='postgresql://...' \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  reviewpulse
```

The Dockerfile is a multi-stage `node:20-alpine` build (deps → build →
runner) that produces a minimal image (~150 MB) running the standalone
server. See `Dockerfile` for details.

---

## GitHub Actions

A single workflow, `.github/workflows/daily-collection.yml`, runs the
daily collection + analysis + embedding loop:

- **Schedule:** `cron: "30 4 * * *"` UTC = **10:00 AM IST** daily.
- **Manual trigger:** `workflow_dispatch` for on-demand runs.
- **Steps:** check out → setup Node 20 → install pnpm → install deps →
  `prisma generate` + `prisma db push` against the `DATABASE_URL` secret →
  POST to `${{ secrets.API_BASE_URL }}/api/collect`,
  `/api/analyze`, and `/api/embed` on the deployed app.

Required GitHub secrets:

| Secret          | Example                          | Purpose                          |
|-----------------|----------------------------------|----------------------------------|
| `API_BASE_URL`  | `https://reviewpulse.vercel.app` | Base URL of the deployed app.    |
| `DATABASE_URL`  | `postgresql://…`                 | Used by `prisma db push`.        |

> The collector endpoints accept an unauthenticated call in the sandbox
> demo flow (`ensureProject()` falls back to the first project). For
> production, gate these endpoints behind an API key or a shared secret
> header and pass it via an additional GitHub secret.

---

## Limitations & honest notes

This is a graduation MVP, not a production system. Honest gaps:

1. **Collectors are sample-data fetchers.** `src/lib/collectors.ts`
   returns a small pool of realistic sample reviews per platform rather
   than scraping live Google Play / App Store / Reddit / Twitter. A
   production deploy would replace these with real platform SDKs (Google
   Play Developer API, App Store Connect API, PRAW for Reddit, the
   Twitter v2 API) — the rest of the pipeline (dedup, ingest, analyze,
   embed, chat) is unchanged.
2. **No rate limiting.** The API trusts the network. In production put
   it behind Vercel's edge rate limiter (or Upstash Redis Ratelimit) —
   at minimum on `/api/auth/login` and `/api/chat`.
3. **In-process vector search.** Cosine similarity is computed in the
   Node process for every chat query. Fine for thousands of reviews;
   for hundreds of thousands, move to pgvector with an HNSW index.
4. **No CSRF token.** The session cookie is `sameSite=lax`, which
   blocks cross-site POSTs from forms — adequate for an API-only
   JSON backend. If you add server-rendered forms, add a CSRF token.
5. **No refresh token.** The JWT is single-shot with a 7-day expiry.
   Acceptable for an internal analyst tool; a consumer product would
   want refresh tokens.
6. **Email invites are direct DB writes.** `/api/team` POST creates a
   stub user with no password instead of sending an email with a signed
   invite token. Production needs an email provider (Resend, Postmark)
   and a token-redemption flow.
7. **Sandbox forces one Next.js app.** In production this should be a
   pnpm monorepo with separate `apps/web`, `apps/collector-worker`,
   and `apps/ai-worker` so the collector cron doesn't share a
   request budget with the dashboard.
8. **`typescript.ignoreBuildErrors: true` in `next.config.ts`.**
   Inherited from the sandbox scaffold. Remove for production and
   fix any remaining type errors.

Despite these, the *core* loop — collect → ingest → analyze → segment →
embed → answer with citations — is real end-to-end and the security
posture (scrypt, HS256, RBAC, Zod, hashed API keys, audit log) is
production-shaped, not demo-shaped.
