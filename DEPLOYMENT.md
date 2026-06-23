# ReviewPulse — Deployment Guide

This guide takes you from a fresh clone to a live production deployment of
ReviewPulse on **PostgreSQL + pgvector** (Vercel for the Next.js frontend,
Railway optional for a standalone Express backend, Neon for Postgres,
Upstash for Redis, GitHub Actions for the daily collection cron).

The sandbox runs on SQLite for zero-config demos. Production swaps in
Postgres + pgvector so semantic search, embeddings, and the dashboard
scale beyond a single laptop.

---

## Quick Start (5 minutes)

Fastest path if you already have the accounts. Detailed steps below.

```bash
# 1. Clone + install
git clone <your-repo-url> reviewpulse && cd reviewpulse
cp .env.production.example .env.local          # then edit DATABASE_URL + JWT_SECRET
cp prisma/schema.postgres.prisma prisma/schema.prisma
bun install

# 2. Postgres + pgvector (Neon: pgvector is enabled by default)
bunx prisma db push
psql "$DATABASE_URL" -f prisma/add-pgvector.sql

# 3. First-run bootstrap (creates default admin + demo project + 105 reviews)
curl -X POST http://localhost:3000/api/auth/setup
# → log in with pm@reviewpulse.dev / ReviewPulse123!

# 4. Run it
bun dev   # → http://localhost:3000

# 5. Push to Vercel (set the same env vars in the Vercel dashboard)
vercel --prod
```

For the full guided version with screenshots-of-the-mind, read on.

---

## Prerequisites

- **Node 20+** and a package manager: **`bun`** (recommended; lockfile is
  `bun.lock`) or `pnpm`/`npm`.
- **A Postgres database with pgvector**. Easiest options:
  - **Neon** (https://neon.tech) — free tier, pgvector enabled by default, serverless.
  - **Supabase** (https://supabase.com) — free tier, pgvector enabled by default.
  - **Railway** (https://railway.app) — add a Postgres plugin, then run
    `CREATE EXTENSION vector;` once.
- **A Redis instance** (optional but recommended for prod). Easiest:
  **Upstash** (https://upstash.com) — free tier, REST + native Redis.
- **Accounts** for whichever integrations you want to enable:
  - **DeepSeek** (https://platform.deepseek.com) — LLM for review analysis + RAG.
  - **Google Cloud Console** (https://console.cloud.google.com) — Google OAuth.
  - **Twilio** (https://console.twilio.com) — SMS OTP for phone auth.
  - **Resend** (https://resend.com) — transactional email.
  - **Firebase Console** (https://console.firebase.google.com) — Firebase Admin
    for verifying Firebase-issued ID tokens (Google/phone sign-in via the
    Firebase client SDK).
- **Vercel** (https://vercel.com) account for hosting the Next.js app.
- **GitHub** repo for the code + GitHub Actions cron.

---

## Step 1 — Database setup (Neon free tier)

1. Sign up at https://neon.tech and create a new project. Name it
   `reviewpulse-prod` (or similar). Pick the region closest to your users.
2. In the Neon dashboard → **Connection Details** → copy the **Connection
   string**. It looks like:
   ```
   postgresql://neondb_owner:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Verify pgvector is enabled (Neon enables it by default on new projects):
   ```sql
   SELECT extname FROM pg_extension WHERE extname = 'vector';
   ```
   If it returns no rows, run `CREATE EXTENSION vector;` from the Neon SQL
   editor. (Supabase: enabled by default. Railway: run the SQL by hand.)
4. Save the connection string — you'll set it as `DATABASE_URL` in the next
   step.

> **Why pgvector?** ReviewPulse embeds every review with the 384-dim
> `xenova/all-MiniLM-L6-v2` model and runs cosine-similarity search for the
> "Ask the data" RAG chat. On SQLite the vectors are stored as JSON strings
> and similarity is computed in-process. On Postgres+pgvector it's a native
> indexed column with sub-millisecond ANN lookups.

---

## Step 2 — Local setup

1. **Clone + install**
   ```bash
   git clone <your-repo-url> reviewpulse && cd reviewpulse
   bun install
   ```
2. **Copy the env template and fill it in**
   ```bash
   cp .env.production.example .env.local
   ```
   Open `.env.local` and set at minimum:
   - `DATABASE_URL` — your Neon connection string from Step 1.
   - `JWT_SECRET` — generate with `openssl rand -hex 32`.
   - `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local; your real
     domain for prod.
   Optional (each adds one real integration): `DEEPSEEK_API_KEY`,
   `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, `TWILIO_*`,
   `RESEND_*`, `FIREBASE_*`, `REDIS_URL`. See the comments in
   `.env.production.example` for where to get each one.
3. **Switch Prisma to the Postgres schema**
   ```bash
   cp prisma/schema.postgres.prisma prisma/schema.prisma
   ```
   This replaces `provider = "sqlite"` with `provider = "postgresql"` and
   changes `ReviewEmbedding.embedding` from a JSON `String` to
   `Unsupported("vector(384)")` (a column Prisma can't manage directly).
4. **Push the schema**
   ```bash
   bunx prisma db push
   ```
   This creates all tables on your Postgres DB. The `embedding_vec` column
   is NOT created yet (Prisma skips `Unsupported(...)` fields) — that's the
   next step.
5. **Add the pgvector column + index**
   ```bash
   psql "$DATABASE_URL" -f prisma/add-pgvector.sql
   ```
   Or paste the contents of `prisma/add-pgvector.sql` into the Neon SQL
   editor and run it. This: (a) enables the `vector` extension, (b) adds
   `embedding_vec vector(384)` to `review_embeddings`, and (c) builds an
   IVFFlat cosine-similarity index.
6. **Bootstrap the admin + demo data**
   ```bash
   bun dev   # start the dev server in another terminal
   curl -X POST http://localhost:3000/api/auth/setup
   ```
   This is idempotent — it only works when zero users exist. It creates the
   default admin (`pm@reviewpulse.dev` / `ReviewPulse123!`), a demo project,
   and 105 realistic seed reviews with pre-computed AI analysis. You can
   then log in at http://localhost:3000.
7. **Regenerate the Prisma client** (only needed if you changed anything in
   `schema.prisma` since the last `bun install`):
   ```bash
   bunx prisma generate
   ```

You should now be able to log in, see the dashboard with 105 seed reviews,
run a collector, and ask the RAG chat a question. The pgvector column is
empty until you re-embed reviews (visit **Settings → Danger Zone →
Reseed**, or run `bunx prisma db seed` if you wired one).

---

## Step 3 — Deploy frontend to Vercel

The whole app is a single Next.js 16 project, so the frontend IS the app.
The "backend" is just the Next.js API routes (`/api/*`).

1. Push your repo to GitHub (if you haven't already).
2. Go to https://vercel.com/new and **Import** the repo.
3. **Framework preset**: Next.js (auto-detected).
4. **Root Directory**: leave as the repo root. (If you split into a
   monorepo later, set this to `apps/web` or wherever `package.json`
   lives.)
5. **Build Command**: `bun run build` (or leave Vercel's default
   `next build`).
6. **Install Command**: `bun install` (Vercel auto-detects from
   `bun.lock`).
7. **Environment Variables**: add EVERY key from `.env.production.example`
   that you set locally. At minimum:
   - `DATABASE_URL` (Neon connection string)
   - `JWT_SECRET` (the same 32+ char string you generated locally)
   - `NEXT_PUBLIC_APP_URL` = `https://YOUR-VERCEL-DOMAIN.vercel.app`
   - Plus any of `DEEPSEEK_API_KEY`, `GOOGLE_CLIENT_*`, `TWILIO_*`,
     `RESEND_*`, `FIREBASE_*`, `REDIS_URL` that you want enabled.
8. **Deploy**. Vercel runs `bun run build` and ships.
9. After deploy: update `NEXT_PUBLIC_APP_URL` to the production URL Vercel
   assigned (if you didn't know it ahead of time) and re-deploy. Also add
   `https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/google/callback` to
   the Google OAuth console's Authorized redirect URIs.
10. Run first-run setup on the live deploy:
    ```bash
    curl -X POST https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/setup
    ```
    (Only works once, when zero users exist in the DB.)

---

## Step 4 — Deploy backend (optional, for the standalone Express version)

> Skip this step if you deployed the Next.js app to Vercel — the API routes
> are already live there. This section is ONLY for the original monorepo
> Express backend in `apps/api/` (the version in `upload/extracted/...`).

For a long-running worker (collector cron, RAG streaming, webhooks) you may
prefer Railway over Vercel serverless functions:

1. Go to https://railway.app/new → **Deploy from GitHub repo** → pick your
   repo.
2. **Settings → Root Directory**: `apps/api` (or wherever the Express app
   lives). Railway will detect `package.json` and run `npm install` /
   `npm run start`.
3. **Variables**: paste every key from `.env.production.example`. Railway
   accepts multi-line values for `FIREBASE_SERVICE_ACCOUNT` — paste the
   raw JSON (no escaping needed in their UI).
4. **+ Add → Database → PostgreSQL**. Railway provisions a Postgres
   instance. Copy the `DATABASE_URL` from the plugin into your Variables
   and run `prisma db push` + `add-pgvector.sql` against it (you can do
   this from your laptop with the public connection string).
5. **+ Add → Database → Redis**. Copy the `REDIS_URL` into Variables.
6. Set the `PORT` variable if your Express app reads it (Railway auto-injects
   `PORT` and listens on the public domain — make sure your server does
   `app.listen(process.env.PORT || 3001)`).
7. **Deploy**. Watch the logs — Railway restarts on every push to `main`.

If you're using the monorepo, you'll also want to deploy the worker process
(`apps/worker/`) as a separate Railway service so the daily-collection cron
runs in a persistent process rather than via GitHub Actions.

---

## Step 5 — GitHub Actions (daily collection)

ReviewPulse ships with a daily-collection workflow that hits your API once a
day to pull fresh reviews from all enabled `CollectorSource`s.

1. In your repo, open **Settings → Secrets and variables → Actions**.
2. Add these repository secrets:
   - `DATABASE_URL` — same Neon connection string (used by the workflow's
     `prisma db push` step if the schema drifts).
   - `DEEPSEEK_API_KEY` — so the workflow's analysis step uses real LLM.
   - `API_BASE_URL` — `https://YOUR-VERCEL-DOMAIN.vercel.app` (or your
     Railway backend URL). The workflow does `curl -X POST $API_BASE_URL/api/collect`.
   - (Optional) `API_KEY` — if you created an API key in the dashboard for
     the collector, set it here; the workflow will send it as a Bearer token.
3. Enable the workflow file (e.g. `.github/workflows/daily-collection.yml`).
   By default it runs at 09:00 UTC daily. You can also trigger it manually
   from the Actions tab → **Run workflow**.
4. Confirm the first run completes — check the workflow logs for the
   `POST /api/collect` response and the number of new reviews collected.

---

## Step 6 — Verify

1. **Health check** — `curl https://YOUR-DOMAIN/api/health` → expect
   `200 OK` with JSON describing the DB + AI provider status.
2. **Login** — open `https://YOUR-DOMAIN`, click **Sign in**, log in with
   `pm@reviewpulse.dev` / `ReviewPulse123!`. You should land on the
   dashboard.
3. **Run a collector** — **Sources** tab → click **Run now** on a source.
   The collector should fetch reviews, embed them, and the dashboard count
   should bump. Check **Settings → Production Setup** for a live readiness
   panel of every integration (Database, JWT, DeepSeek, Embeddings, Google,
   Twilio, Redis) — each shows a green "Configured" or amber "Not
   configured" badge.
4. **Check the dashboard** — Overview tab shows review counts, sentiment
   trend, theme distribution, and top issues. Chat tab: ask "What are the
   top complaints about Spotify?" → should get a real RAG answer with
   `Review #N` citations sourced from your seed + collected reviews.
5. **Check pgvector** — in the Neon SQL editor:
   ```sql
   SELECT COUNT(*) FROM review_embeddings WHERE embedding_vec IS NOT NULL;
   ```
   Should return a positive number after the collector runs (or after you
   re-embed seed reviews from Settings → Danger Zone → Reseed).

---

## Troubleshooting

### `prisma db push` fails with "extension vector does not exist"
You forgot to enable pgvector on the DB. Run `CREATE EXTENSION vector;`
from your DB's SQL editor. On Neon/Supabase it's enabled by default; on
self-hosted Postgres you may need to install the `postgresql-15-pgvector`
package first.

### `prisma db push` fails on `embedding` column with `Unsupported("vector(384)")`
This is expected — Prisma skips `Unsupported(...)` fields during `db push`.
The column is created by `prisma/add-pgvector.sql` instead. Run that script
after `db push` and the error goes away on the next push (the column
already exists, the script is idempotent).

### Login works locally but not on Vercel
Almost always a `JWT_SECRET` mismatch. The `JWT_SECRET` you used to sign
the session cookie locally must match the one Vercel uses to verify it.
Set the same `JWT_SECRET` in the Vercel dashboard and clear cookies.

### `google-play-scraper` crashes on Vercel
The scraper is ESM-only and can hit Vercel's Node module resolution quirks.
Make sure `next.config.ts` has `serverExternalPackages: ['google-play-scraper', 'app-store-scraper']` (or `transpilePackages`). If it still fails,
move that collector to a Railway worker (Step 4).

### OAuth redirect URI mismatch (`redirect_uri_mismatch`)
The redirect URI you registered in Google Cloud Console must EXACTLY match
what the app sends. It's `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback`.
Add both `http://localhost:3000/api/auth/google/callback` (dev) and
`https://YOUR-DOMAIN/api/auth/google/callback` (prod) to the Authorized
redirect URIs list.

### Twilio SMS not arriving
- Verify `TWILIO_PHONE_NUMBER` is in E.164 (`+15551234567`).
- For trial accounts, you can only send to **verified** numbers — upgrade
  the account or verify the recipient's number in the Twilio console.
- Check the Twilio console → Logs → Messages for delivery errors.

### pgvector queries are slow / not using the index
IVFFlat needs to be built with enough rows to be useful. If you built the
index before loading data, drop and recreate it after a bulk load:
```sql
DROP INDEX review_embeddings_embedding_vec_idx;
CREATE INDEX review_embeddings_embedding_vec_idx
  ON review_embeddings USING ivfflat (embedding_vec vector_cosine_ops)
  WITH (lists = 100);
ANALYZE review_embeddings;
```
For >1M rows, switch to HNSW:
```sql
CREATE INDEX review_embeddings_embedding_vec_hnsw_idx
  ON review_embeddings USING hnsw (embedding_vec vector_cosine_ops);
```

### `FIREBASE_SERVICE_ACCOUNT` parse error on Vercel
Vercel's env var UI accepts the raw JSON object directly — don't escape the
inner quotes. If you're loading from a `.env` file (local dev or Railway's
bulk import), escape inner double-quotes with `\"`. Use the one-liner in
`.env.production.example` to generate the escaped form:
```bash
node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('serviceAccount.json','utf8'))))"
```

### Vercel function timeout on `/api/collect`
The free Hobby plan caps functions at 10s. A collector pulling 100+
reviews + embedding them will exceed that. Options: (a) bump to Vercel Pro
(60s default, 300s max), (b) move the collector to a Railway worker
(Step 4), (c) run it via GitHub Actions (Step 5) which has no timeout.

### "Database is SQLite" warning on the Production Setup tab
You're still running the SQLite schema. Make sure `prisma/schema.prisma`
has `provider = "postgresql"` (run `cp prisma/schema.postgres.prisma
prisma/schema.prisma`) and that `DATABASE_URL` starts with `postgresql://`
or `postgres://`. The status panel at `/api/config/env` reads this prefix
to decide which provider to report.

---

## File reference

| File | Purpose |
| --- | --- |
| `prisma/schema.prisma` | The ACTIVE schema (SQLite in sandbox, Postgres after `cp`). |
| `prisma/schema.postgres.prisma` | Production schema (Postgres + pgvector). Copy over `schema.prisma` to switch. |
| `prisma/add-pgvector.sql` | Run after `prisma db push` to add the `vector` extension, the `embedding_vec` column, and an IVFFlat index. |
| `.env.production.example` | Template with every env var the app reads. Copy to `.env.local` (dev) or paste into your host's env vars UI (prod). |
| `DEPLOYMENT.md` | This file. |

---

## What's next

- **Backups**: Neon and Supabase both do point-in-time restore on the free
  tier. Confirm PITR is enabled for your prod DB.
- **Monitoring**: add Sentry (Next.js SDK) for error tracking and
  Vercel Analytics (or Plausible) for traffic. Both are env-var-only
  integrations.
- **Rate limiting**: the in-memory limiter in `src/middleware.ts` is
  per-instance. For multi-instance deploys, set `REDIS_URL` and the app
  will use it for distributed rate limiting (roadmap; currently used for
  refresh-token rotation + OTP store).
- **Custom domains**: point your domain at Vercel (Settings → Domains) and
  update `NEXT_PUBLIC_APP_URL` + Google OAuth redirect URI to match.
