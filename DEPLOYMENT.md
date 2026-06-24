# ReviewPulse — Deployment Guide (Demo Mode)

This guide takes you from a fresh clone to a live production deployment of
ReviewPulse on **PostgreSQL + pgvector** (Vercel for the Next.js frontend,
Neon for Postgres, Hugging Face for free LLM inference, and GitHub Actions
for the daily collection cron).

This is the simplified deployment for the public demo. Auth, SMS, Email, and
Redis have been stripped out.

---

## Quick Start (5 minutes)

```bash
# 1. Clone + install
git clone <your-repo-url> reviewpulse && cd reviewpulse
cp .env.example .env          # then edit DATABASE_URL + JWT_SECRET + HUGGINGFACE_API_KEY
cp prisma/schema.postgres.prisma prisma/schema.prisma
bun install

# 2. Postgres + pgvector (Neon: pgvector is enabled by default)
bunx prisma db push
psql "$DATABASE_URL" -f prisma/add-pgvector.sql

# 3. First-run bootstrap (creates demo project + 105 reviews)
curl -X POST http://localhost:3000/api/auth/setup

# 4. Run it
bun dev   # → http://localhost:3000

# 5. Push to Vercel (set the same env vars in the Vercel dashboard)
vercel --prod
```

---

## Prerequisites

- **Node 20+** and `bun` (recommended)
- **A Postgres database with pgvector**. Easiest option: **Neon** (https://neon.tech)
- **Hugging Face Token** (https://huggingface.co/settings/tokens) for FREE LLM inference.
- **Vercel** (https://vercel.com) account for hosting the Next.js app.
- **GitHub** repo for the code + GitHub Actions cron.

---

## Step 1 — Database setup (Neon free tier)

1. Sign up at https://neon.tech and create a new project.
2. In the Neon dashboard → **Connection Details** → copy the **Connection string**.
3. Verify pgvector is enabled (Neon enables it by default on new projects):
   ```sql
   SELECT extname FROM pg_extension WHERE extname = 'vector';
   ```
4. Save the connection string for `DATABASE_URL`.

---

## Step 2 — Local setup

1. **Clone + install**
   ```bash
   git clone <your-repo-url> reviewpulse && cd reviewpulse
   bun install
   ```
2. **Copy the env template and fill it in**
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and set:
   - `DATABASE_URL` — your Neon connection string.
   - `JWT_SECRET` — random string.
   - `HUGGINGFACE_API_KEY` — your free HF token.
3. **Switch Prisma to the Postgres schema**
   ```bash
   cp prisma/schema.postgres.prisma prisma/schema.prisma
   ```
4. **Push the schema**
   ```bash
   bunx prisma db push
   ```
5. **Add the pgvector column + index**
   ```bash
   psql "$DATABASE_URL" -f prisma/add-pgvector.sql
   ```
6. **Bootstrap the demo data**
   ```bash
   bun dev
   curl -X POST http://localhost:3000/api/auth/setup
   ```

---

## Step 3 — Deploy to Vercel

1. Push your repo to GitHub.
2. Go to https://vercel.com/new and **Import** the repo.
3. **Framework preset**: Next.js.
4. **Environment Variables**: add:
   - `DATABASE_URL` (Neon)
   - `JWT_SECRET` (random string)
   - `HUGGINGFACE_API_KEY` (HF token)
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
5. **Deploy**.
6. Run first-run setup on the live deploy:
   ```bash
   curl -X POST https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/setup
   ```

---

## Step 4 — GitHub Actions (daily collection)

1. In your repo, open **Settings → Secrets and variables → Actions**.
2. Add these repository secrets:
   - `DATABASE_URL` — Neon connection string
   - `HUGGINGFACE_API_KEY` — HF token
   - `API_BASE_URL` — `https://YOUR-VERCEL-DOMAIN.vercel.app`
3. Enable the workflow file `.github/workflows/daily-collection.yml`.
