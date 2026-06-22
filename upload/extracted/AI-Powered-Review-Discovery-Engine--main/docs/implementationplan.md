# AI-Powered Review Discovery Engine — Implementation Plan

> **Document status:** Living document. Updated as design decisions are made and phases are completed.
>
> **Last updated:** June 2026
> **Related documents:** [Problem Statement](./problemstatement.md) · [Architecture](./architecture.md)

---

## Table of Contents

1. [Execution Principles](#1-execution-principles)
2. [Phase Dependency Map](#2-phase-dependency-map)
3. [Phase Breakdown](#3-phase-breakdown)
   - [Phase 1: Project Foundation & Infrastructure](#phase-1-project-foundation--infrastructure) — 3 days
   - [Phase 2: Database Schema Design & Implementation](#phase-2-database-schema-design--implementation) — 2 days
   - [Phase 3: Authentication, Authorization & API Scaffold](#phase-3-authentication-authorization--api-scaffold) — 3 days
   - [Phase 4: AI Prompt Engineering](#phase-4-ai-prompt-engineering-parallel-track) — 3 days _(parallel track)_
   - [Phase 5: Review Ingestion & Upload Module](#phase-5-review-ingestion--upload-module) — 3 days
   - [Phase 6: AI Pipeline Integration](#phase-6-ai-pipeline-integration) — 4 days
   - [Phase 7: Analytics Engine & API](#phase-7-analytics-engine--api) — 3 days
   - [Phase 8: Frontend Dashboard & User Experience](#phase-8-frontend-dashboard--user-experience) — 5 days
   - [Phase 9: Testing, Hardening & Production Deployment](#phase-9-testing-hardening--production-deployment) — 4 days
4. [Master Timeline](#4-master-timeline)
5. [MVP Feature Matrix](#5-mvp-feature-matrix)
6. [Risk Register](#6-risk-register)
7. [Definition of Done](#7-definition-of-done-global)

---

## 1. Execution Principles

| Principle                                  | Application                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Build foundations first**                | Database schema, auth, and project infrastructure before any features                            |
| **Vertical slices, not horizontal layers** | Build one complete feature end-to-end (upload → analyze → display) before building the next      |
| **Test as you go**                         | Every phase includes its own testing. No "testing phase" at the end.                             |
| **AI pipeline is the product**             | Allocate disproportionate time and rigor to the AI stages. Everything else serves the AI output. |
| **Deploy early, deploy often**             | First deployment happens in Phase 3, not Phase 9.                                                |
| **Optimize for developer velocity**        | Good tooling, clear patterns, and hot reload save more time than any feature shortcut.           |
| **Honest time estimates**                  | Every estimate assumes a single full-stack developer working focused hours. Buffer is included.  |

---

## 2. Phase Dependency Map

```
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 5 ──▶ Phase 6 ──▶ Phase 7 ──▶ Phase 8 ──▶ Phase 9
Foundation   Database    Auth &       Review       AI           Analytics   Frontend    Test &
& Setup      Schema      API          Ingestion    Pipeline     Engine      Dashboard   Deploy
             Design      Scaffold     Module

                         ┌─── Phase 4: AI Prompt Engineering (parallel track) ───┐
                         │   (starts alongside Phase 3, feeds into Phase 6)       │
                         └────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             PHASE DEPENDENCY MATRIX                                       │
│                                                                                           │
│  Phase  │ Name                    │ Depends On  │ Blocks              │ Parallelizable    │
│  ───────┼─────────────────────────┼─────────────┼─────────────────────┼───────────────── │
│  1      │ Foundation              │ Nothing     │ All                 │ —                 │
│  2      │ Database Schema         │ 1           │ 3, 5, 6, 7          │ —                 │
│  3      │ Auth & API Scaffold     │ 2           │ 5, 6, 7, 8          │ Phase 4           │
│  4      │ AI Prompt Engineering   │ 1           │ 6                   │ 2, 3, 5           │
│  5      │ Review Ingestion        │ 2, 3        │ 6, 7, 8             │ —                 │
│  6      │ AI Pipeline             │ 3, 4        │ 7, 8                │ 5 (partially)     │
│  7      │ Analytics Engine        │ 5, 6        │ 8                   │ —                 │
│  8      │ Frontend Dashboard      │ 5, 6, 7     │ 9                   │ —                 │
│  9      │ Testing & Deployment    │ All         │ —                   │ —                 │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

> **Phase 4 is a parallel track.** AI prompt engineering can start the moment the shared TypeScript types and testing framework (Phase 1) are in place. It does not need the database or auth system. Running Phase 4 in parallel with Phase 3 saves 3 days off the critical path.

---

## 3. Phase Breakdown

---

### PHASE 1: Project Foundation & Infrastructure

**Duration:** 3 days
**Objective:** Production-grade project scaffolding that supports the entire product lifecycle. Not a quick start — a correct start.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 DETAIL                                                                   │
│                                                                                   │
│ Day 1: Repository & Tooling                                                      │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 1.1: Initialize Monorepo Structure                                          │
│ ├─ Create repository (GitHub)                                                    │
│ ├─ Set up monorepo structure:                                                    │
│ │   /apps                                                                         │
│ │     /web          (Next.js frontend)                                           │
│ │     /worker       (AI pipeline + ingestion workers)                            │
│ │   /packages                                                                     │
│ │     /shared       (Shared types, utils, constants)                             │
│ │     /database     (Schema, migrations, seed data)                              │
│ │     /ai           (Prompts, model configs, pipeline logic)                     │
│ │   /infrastructure                                                               │
│ │     /docker       (Dockerfiles, docker-compose)                                │
│ │     /scripts      (Dev scripts, deploy scripts)                                │
│ ├─ Configure package manager (pnpm workspaces)                                  │
│ ├─ Set up shared TypeScript config (tsconfig.base.json)                          │
│ ├─ Configure path aliases (@review-engine/shared, etc.)                          │
│ └─ Acceptance: `pnpm install` works, all packages resolve                        │
│                                                                                   │
│ Task 1.2: Code Quality Toolchain                                                 │
│ ├─ ESLint with strict TypeScript rules                                           │
│ ├─ Prettier with consistent formatting                                           │
│ ├─ Husky pre-commit hooks (lint + format)                                        │
│ ├─ lint-staged for incremental linting                                           │
│ ├─ Commitlint for conventional commits                                           │
│ └─ Acceptance: Bad code cannot be committed                                      │
│                                                                                   │
│ Task 1.3: CI/CD Pipeline (GitHub Actions)                                        │
│ ├─ Workflow 1: PR checks                                                         │
│ │   Lint → Type check → Unit tests → Integration tests                          │
│ ├─ Workflow 2: Build & push Docker images                                        │
│ ├─ Workflow 3: Deploy to staging (on merge to main)                              │
│ ├─ Workflow 4: Deploy to production (manual approval)                            │
│ ├─ Cache node_modules and build artifacts                                        │
│ └─ Acceptance: PR triggers full check pipeline                                   │
│                                                                                   │
│ Day 2: Docker & Local Development                                                │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 1.4: Docker Configuration                                                   │
│ ├─ Dockerfile (multi-stage: build → production)                                  │
│ ├─ Dockerfile.worker (AI pipeline worker)                                        │
│ ├─ docker-compose.yml for local development:                                     │
│ │   ├── web (Next.js, hot reload)                                               │
│ │   ├── worker (AI worker, hot reload)                                          │
│ │   ├── postgres (16)                                                            │
│ │   ├── redis (7)                                                                │
│ │   ├── chromadb (latest)                                                        │
│ │   └── minio (S3-compatible storage)                                            │
│ ├─ docker-compose.prod.yml for production build                                  │
│ ├─ .dockerignore optimized                                                       │
│ └─ Acceptance: `docker compose up` starts entire stack locally                   │
│                                                                                   │
│ Task 1.5: Environment Configuration                                              │
│ ├─ .env.example with all required variables documented                           │
│ ├─ .env.development (local defaults)                                             │
│ ├─ .env.staging (staging config)                                                 │
│ ├─ .env.production (production — never committed)                                │
│ ├─ Zod-based env validation (fail fast on missing vars)                          │
│ │   const env = z.object({                                                        │
│ │     DATABASE_URL: z.string().url(),                                            │
│ │     REDIS_URL: z.string().url(),                                               │
│ │     ANTHROPIC_API_KEY: z.string().min(1),                                      │
│ │     VOYAGE_API_KEY: z.string().min(1),                                         │
│ │     JWT_SECRET: z.string().min(32),                                            │
│ │     CHROMA_URL: z.string().url(),                                              │
│ │     ...                                                                        │
│ │   }).parse(process.env)                                                        │
│ └─ Acceptance: App crashes immediately with clear message if env is wrong        │
│                                                                                   │
│ Day 3: Database Foundation & Testing Framework                                   │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 1.6: Database Setup                                                         │
│ ├─ Configure Drizzle ORM (or Prisma) with PostgreSQL                             │
│ ├─ Initial migration system (up/down migrations)                                 │
│ ├─ Migration runner in CI (before app deploy)                                    │
│ ├─ Seed script framework (for local dev data)                                    │
│ ├─ Database connection pooling configuration                                     │
│ │   (pg-pool: max 20 connections, idle timeout 30s)                              │
│ ├─ Enable required PostgreSQL extensions:                                        │
│ │   ├── pg_trgm (for fuzzy text search)                                          │
│ │   └── uuid-ossp (for UUID generation)                                          │
│ └─ Acceptance: `pnpm db:migrate` and `pnpm db:seed` work                         │
│                                                                                   │
│ Task 1.7: Testing Framework                                                      │
│ ├─ Vitest for unit tests (fast, native TypeScript)                               │
│ ├─ Test utilities:                                                               │
│ │   ├── Database test helpers (create test project, create test user)            │
│ │   ├── API test helpers (authenticated request factory)                         │
│ │   ├── Mock helpers (LLM response mocks, external API mocks)                   │
│ │   └── Fixtures (sample reviews in various formats)                             │
│ ├─ Test database strategy:                                                       │
│ │   ├── Separate test database (review_engine_test)                              │
│ │   ├── Reset between test suites (truncate all tables)                          │
│ │   └── Transaction rollback for test isolation                                  │
│ ├─ Coverage configuration (Vitest coverage, 80% target)                          │
│ └─ Acceptance: `pnpm test` runs with 0 tests but clean setup                     │
│                                                                                   │
│ Task 1.8: Shared Type Definitions                                                │
│ ├─ Define core domain types:                                                     │
│ │   ├── Review, User, Project                                                   │
│ │   ├── ReviewSource, Theme, Insight                                            │
│ │   ├── SentimentResult, ThemeResult, PriorityResult                            │
│ │   └── API request/response types                                               │
│ ├─ Zod schemas for runtime validation (shared between API & frontend)            │
│ ├─ Type exports for all packages                                                 │
│ └─ Acceptance: Types compile, are importable from any package                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Phase 1 Deliverables:**

- Monorepo with clean structure, tooling, and CI/CD
- Docker-based local development (one command to start everything)
- Database running with migrations and seed framework
- ChromaDB container running alongside PostgreSQL and Redis
- Testing framework ready
- Shared type definitions for core domain
- Environment management with validation

**Phase 1 Risks:**
| Risk | Mitigation |
|---|---|
| Docker networking issues between containers | Test early, document common fixes in README |
| ChromaDB cold-start time in CI | Use health checks; wait for ready before running tests |
| pnpm workspace resolution conflicts | Pin versions, use `.npmrc` for hoisting config |

---

### PHASE 2: Database Schema Design & Implementation

**Duration:** 2 days
**Objective:** Complete, production-grade database schema with proper indexing, relationships, constraints, and project-level data isolation.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 DETAIL                                                                   │
│                                                                                   │
│ Day 1: Core Schema Design & Migration                                            │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 2.1: Design & Create Core Tables                                            │
│                                                                                   │
│   TABLE: users                                                                   │
│   ├─ id              UUID PRIMARY KEY DEFAULT gen_random_uuid()                  │
│   ├─ email           VARCHAR(255) NOT NULL UNIQUE                                │
│   ├─ name            VARCHAR(255)                                                │
│   ├─ password_hash   VARCHAR(255)                                                │
│   ├─ role            user_role DEFAULT 'viewer' (admin/analyst/viewer)           │
│   ├─ avatar_url      TEXT                                                        │
│   ├─ is_active       BOOLEAN DEFAULT TRUE                                        │
│   ├─ last_login_at   TIMESTAMPTZ                                                 │
│   ├─ created_at      TIMESTAMPTZ DEFAULT NOW()                                   │
│   ├─ updated_at      TIMESTAMPTZ DEFAULT NOW()                                   │
│   └─ INDEXES: email (unique), role                                               │
│                                                                                   │
│   TABLE: projects                                                                │
│   ├─ id              UUID PRIMARY KEY DEFAULT gen_random_uuid()                  │
│   ├─ owner_id        UUID REFERENCES users(id) ON DELETE CASCADE                 │
│   ├─ name            VARCHAR(255) NOT NULL                                       │
│   ├─ description     TEXT                                                        │
│   ├─ app_store_url   TEXT                                                        │
│   ├─ google_play_url TEXT                                                        │
│   ├─ settings        JSONB DEFAULT '{}'                                          │
│   ├─ created_at      TIMESTAMPTZ DEFAULT NOW()                                   │
│   ├─ updated_at      TIMESTAMPTZ DEFAULT NOW()                                   │
│   └─ INDEXES: owner_id                                                           │
│                                                                                   │
│   TABLE: project_members                                                         │
│   ├─ id              UUID PRIMARY KEY DEFAULT gen_random_uuid()                  │
│   ├─ project_id      UUID REFERENCES projects(id) ON DELETE CASCADE              │
│   ├─ user_id         UUID REFERENCES users(id) ON DELETE CASCADE                 │
│   ├─ role            user_role NOT NULL DEFAULT 'viewer'                         │
│   ├─ created_at      TIMESTAMPTZ DEFAULT NOW()                                   │
│   ├─ UNIQUE(project_id, user_id)                                                 │
│   └─ INDEXES: project_id, user_id                                                │
│                                                                                   │
│   TABLE: reviews                                                                 │
│   ├─ id                   UUID PRIMARY KEY DEFAULT gen_random_uuid()             │
│   ├─ project_id           UUID REFERENCES projects(id) ON DELETE CASCADE         │
│   ├─ source               review_source NOT NULL                                 │
│   ├─ source_review_id     VARCHAR(255)                                           │
│   ├─ review_text          TEXT NOT NULL                                          │
│   ├─ review_title         TEXT                                                   │
│   ├─ rating               SMALLINT CHECK (rating BETWEEN 1 AND 5)               │
│   ├─ author_name          VARCHAR(255)                                           │
│   ├─ review_date          TIMESTAMPTZ NOT NULL                                   │
│   ├─ language             VARCHAR(10) DEFAULT 'en'                               │
│   ├─ content_hash         VARCHAR(64) NOT NULL                                   │
│   ├─ metadata             JSONB DEFAULT '{}'                                     │
│   │                                                                              │
│   │── Processing State ──│                                                       │
│   ├─ processing_status    processing_status DEFAULT 'pending'                    │
│   ├─ processed_at         TIMESTAMPTZ                                            │
│   ├─ processing_error     TEXT                                                   │
│   ├─ retry_count          SMALLINT DEFAULT 0                                     │
│   │                                                                              │
│   │── AI Analysis (populated by pipeline) ──│                                   │
│   ├─ sentiment            sentiment_type                                         │
│   ├─ sentiment_confidence FLOAT                                                  │
│   ├─ theme                theme_category                                         │
│   ├─ sub_theme            VARCHAR(255)                                           │
│   ├─ priority             priority_level                                         │
│   ├─ priority_reason      TEXT                                                   │
│   ├─ key_phrases          TEXT[]                                                 │
│   ├─ ai_summary           TEXT                                                   │
│   ├─ is_bug               BOOLEAN DEFAULT FALSE                                  │
│   ├─ is_feature_request   BOOLEAN DEFAULT FALSE                                  │
│   ├─ actionable           BOOLEAN DEFAULT FALSE                                  │
│   │                                                                              │
│   │── Vector Reference ──│                                                       │
│   ├─ embedding_id         VARCHAR(255)  (ChromaDB document ID)                   │
│   ├─ created_at           TIMESTAMPTZ DEFAULT NOW()                              │
│   ├─ updated_at           TIMESTAMPTZ DEFAULT NOW()                              │
│   ├─ UNIQUE(project_id, source, source_review_id)                                │
│   └─ INDEXES:                                                                    │
│       (project_id)                                                                │
│       (project_id, sentiment)                                                     │
│       (project_id, theme)                                                         │
│       (project_id, priority)                                                      │
│       (project_id, review_date DESC)                                              │
│       (project_id, processing_status)                                             │
│       content_hash                                                                │
│       GIN trigram index on review_text (for full-text fallback)                   │
│       composite: (project_id, sentiment, theme, priority, review_date DESC)       │
│                                                                                   │
│ Task 2.2: Supporting Tables                                                      │
│                                                                                   │
│   TABLE: upload_batches                                                          │
│   ├─ id              UUID PRIMARY KEY DEFAULT gen_random_uuid()                  │
│   ├─ project_id      UUID REFERENCES projects(id) ON DELETE CASCADE              │
│   ├─ uploaded_by     UUID REFERENCES users(id)                                   │
│   ├─ filename        VARCHAR(255) NOT NULL                                       │
│   ├─ source          review_source DEFAULT 'csv_upload'                          │
│   ├─ file_url        TEXT                                                        │
│   ├─ total_rows      INTEGER DEFAULT 0                                           │
│   ├─ processed_rows  INTEGER DEFAULT 0                                           │
│   ├─ failed_rows     INTEGER DEFAULT 0                                           │
│   ├─ status          processing_status DEFAULT 'pending'                         │
│   ├─ error_log       JSONB DEFAULT '[]'                                          │
│   ├─ started_at      TIMESTAMPTZ                                                 │
│   ├─ completed_at    TIMESTAMPTZ                                                 │
│   ├─ created_at      TIMESTAMPTZ DEFAULT NOW()                                   │
│   └─ INDEXES: project_id, status                                                 │
│                                                                                   │
│   TABLE: insights                                                                │
│   ├─ id               UUID PRIMARY KEY DEFAULT gen_random_uuid()                 │
│   ├─ project_id       UUID REFERENCES projects(id) ON DELETE CASCADE             │
│   ├─ insight_type     VARCHAR(50) NOT NULL                                       │
│   ├─ theme            theme_category                                             │
│   ├─ title            VARCHAR(500) NOT NULL                                      │
│   ├─ summary          TEXT NOT NULL                                              │
│   ├─ details          JSONB DEFAULT '{}'                                         │
│   ├─ severity         priority_level                                             │
│   ├─ review_count     INTEGER DEFAULT 0                                          │
│   ├─ date_range_start TIMESTAMPTZ                                                │
│   ├─ date_range_end   TIMESTAMPTZ                                                │
│   ├─ is_read          BOOLEAN DEFAULT FALSE                                      │
│   ├─ is_dismissed     BOOLEAN DEFAULT FALSE                                      │
│   ├─ created_at       TIMESTAMPTZ DEFAULT NOW()                                  │
│   └─ INDEXES: project_id, (project_id, insight_type),                           │
│               (project_id, is_read) WHERE is_read = false                        │
│                                                                                   │
│ Day 2: Analytics, Chat & Audit Tables                                            │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 2.3: Analytics & Chat Tables                                                │
│                                                                                   │
│   TABLE: analytics_daily                                                         │
│   ├─ id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()              │
│   ├─ project_id          UUID REFERENCES projects(id) ON DELETE CASCADE          │
│   ├─ date                DATE NOT NULL                                           │
│   ├─ total_reviews       INTEGER DEFAULT 0                                       │
│   ├─ avg_rating          FLOAT                                                   │
│   ├─ sentiment_positive  INTEGER DEFAULT 0                                       │
│   ├─ sentiment_negative  INTEGER DEFAULT 0                                       │
│   ├─ sentiment_neutral   INTEGER DEFAULT 0                                       │
│   ├─ sentiment_mixed     INTEGER DEFAULT 0                                       │
│   ├─ top_themes          JSONB   — [{theme, count, avg_sentiment}]               │
│   ├─ top_issues          JSONB   — [{issue, count, priority}]                    │
│   ├─ created_at          TIMESTAMPTZ DEFAULT NOW()                               │
│   ├─ UNIQUE(project_id, date)                                                    │
│   └─ INDEXES: (project_id, date DESC)                                            │
│                                                                                   │
│   TABLE: chat_sessions                                                           │
│   ├─ id          UUID PRIMARY KEY DEFAULT gen_random_uuid()                      │
│   ├─ project_id  UUID REFERENCES projects(id) ON DELETE CASCADE                  │
│   ├─ user_id     UUID REFERENCES users(id) ON DELETE CASCADE                     │
│   ├─ title       VARCHAR(255)                                                    │
│   └─ created_at  TIMESTAMPTZ DEFAULT NOW()                                       │
│                                                                                   │
│   TABLE: chat_messages                                                           │
│   ├─ id              UUID PRIMARY KEY DEFAULT gen_random_uuid()                  │
│   ├─ session_id      UUID REFERENCES chat_sessions(id) ON DELETE CASCADE         │
│   ├─ role            VARCHAR(20) NOT NULL  ('user' | 'assistant')                │
│   ├─ content         TEXT NOT NULL                                               │
│   ├─ source_reviews  JSONB  (cited review IDs + snippets)                        │
│   ├─ token_count     INTEGER                                                     │
│   ├─ created_at      TIMESTAMPTZ DEFAULT NOW()                                   │
│   └─ INDEXES: (session_id, created_at)                                           │
│                                                                                   │
│   TABLE: saved_searches                                                          │
│   ├─ id          UUID PRIMARY KEY DEFAULT gen_random_uuid()                      │
│   ├─ project_id  UUID REFERENCES projects(id) ON DELETE CASCADE                  │
│   ├─ user_id     UUID REFERENCES users(id) ON DELETE CASCADE                     │
│   ├─ name        VARCHAR(255) NOT NULL                                           │
│   ├─ filters     JSONB NOT NULL                                                  │
│   └─ created_at  TIMESTAMPTZ DEFAULT NOW()                                       │
│                                                                                   │
│   TABLE: activity_log                                                            │
│   ├─ id          UUID PRIMARY KEY DEFAULT gen_random_uuid()                      │
│   ├─ project_id  UUID REFERENCES projects(id) ON DELETE SET NULL                 │
│   ├─ user_id     UUID REFERENCES users(id) ON DELETE SET NULL                   │
│   ├─ action      VARCHAR(100) NOT NULL                                           │
│   ├─ entity_type VARCHAR(50)                                                     │
│   ├─ entity_id   UUID                                                            │
│   ├─ details     JSONB                                                           │
│   ├─ created_at  TIMESTAMPTZ DEFAULT NOW()                                       │
│   └─ INDEXES: (project_id, created_at DESC), (project_id, user_id)              │
│                                                                                   │
│ Task 2.4: Seed Data                                                              │
│ ├─ Create seed script with:                                                      │
│ │   ├── 2 demo projects                                                         │
│ │   ├── 4 demo users (different roles)                                           │
│ │   ├── 500 sample reviews (realistic, varied sentiment/themes)                 │
│ │   └── 5 pre-computed insights                                                 │
│ ├─ Seed data includes edge cases:                                                │
│ │   ├── Reviews in non-English languages                                        │
│ │   ├── Very short reviews ("bad")                                              │
│ │   ├── Very long reviews (500+ words)                                          │
│ │   ├── Reviews with no rating (text-only)                                      │
│ │   └── Reviews with special characters and emoji                               │
│ └─ Acceptance: `pnpm db:seed` populates demo environment                        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Phase 2 Deliverables:**

- Complete PostgreSQL schema (12 tables across 4 enum types)
- All indexes optimized for expected query patterns
- Migration system (versioned, reversible)
- Seed data for development and testing

**Phase 2 Risks:**
| Risk | Mitigation |
|---|---|
| Schema design doesn't match actual query patterns | Design schema around the API endpoints and dashboard queries, not abstract entities |
| Migration conflicts during parallel development | Sequential migration numbering, rebase workflow enforced via CI |

---

### PHASE 3: Authentication, Authorization & API Scaffold

**Duration:** 3 days
**Objective:** Full authentication system, role-based access control, and API infrastructure that all subsequent features plug into.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3 DETAIL                                                                   │
│                                                                                   │
│ Day 1: Authentication System                                                     │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 3.1: Auth Module Implementation                                             │
│ ├─ Registration flow:                                                            │
│ │   POST /api/v1/auth/register                                                  │
│ │   ├── Validate: email, password (8+ chars, 1 upper, 1 number, 1 special)      │
│ │   ├── Hash password (bcrypt, 12 rounds)                                       │
│ │   ├── Create user record                                                       │
│ │   ├── Generate email verification token                                       │
│ │   ├── Send verification email (Resend)                                         │
│ │   └── Return: user object + tokens                                            │
│ │                                                                               │
│ ├─ Login flow:                                                                   │
│ │   POST /api/v1/auth/login                                                     │
│ │   ├── Validate credentials                                                    │
│ │   ├── Generate JWT pair:                                                      │
│ │   │   Access token: 15 min expiry, contains {userId, role}                   │
│ │   │   Refresh token: 7 day expiry, stored hashed in Redis                    │
│ │   ├── Record login in activity_log                                            │
│ │   └── Return: user object + access_token + refresh_token                     │
│ │                                                                               │
│ ├─ Token refresh:                                                                │
│ │   POST /api/v1/auth/refresh                                                   │
│ │   ├── Validate refresh token (check Redis for hash match)                    │
│ │   ├── Issue new access token                                                  │
│ │   ├── Rotate refresh token (old one invalidated)                              │
│ │   └── Return: new access_token + new refresh_token                            │
│ │                                                                               │
│ ├─ Logout:                                                                       │
│ │   POST /api/v1/auth/logout                                                    │
│ │   ├── Blacklist current access token in Redis (TTL = remaining expiry)        │
│ │   ├── Remove refresh token from Redis                                         │
│ │   └── Return: 204 No Content                                                  │
│ │                                                                               │
│ ├─ Password reset:                                                               │
│ │   POST /api/v1/auth/forgot-password    → Send reset email with token         │
│ │   POST /api/v1/auth/reset-password     → Validate token, update password     │
│ │                                                                               │
│ └─ Acceptance: Full auth lifecycle works via API                                 │
│                                                                                   │
│ Task 3.2: Auth Middleware                                                        │
│ ├─ JWT verification middleware:                                                  │
│ │   ├── Extract Bearer token from Authorization header                          │
│ │   ├── Verify JWT signature and expiry                                         │
│ │   ├── Check token not in blacklist (Redis)                                    │
│ │   ├── Load user context                                                       │
│ │   ├── Set: req.user = { id, role, email }                                    │
│ │   └── On failure: 401 Unauthorized with descriptive error                    │
│ │                                                                               │
│ ├─ RBAC middleware factory:                                                      │
│ │   requireRole('admin') → checks req.user.role >= admin                       │
│ │   Role hierarchy: admin > analyst > viewer                                    │
│ │   └─ On failure: 403 Forbidden                                                │
│ │                                                                               │
│ ├─ Project authorization middleware:                                             │
│ │   ├── Verify user is a member of the requested project                       │
│ │   ├── Check that user's project role meets required minimum                  │
│ │   └── On failure: 403 Forbidden (never 404 — no resource enumeration)        │
│ │                                                                               │
│ ├─ Rate limiting middleware:                                                     │
│ │   ├── Per-user: 100 requests/minute (sliding window in Redis)                │
│ │   ├── Auth endpoints: 10 requests/minute (brute force protection)            │
│ │   └── Returns: 429 Too Many Requests with Retry-After header                 │
│ │                                                                               │
│ └─ Acceptance: Protected routes reject unauthorized requests correctly           │
│                                                                                   │
│ Day 2: Project Management & API Infrastructure                                   │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 3.3: Project & Member Management                                            │
│ ├─ Project CRUD:                                                                 │
│ │   POST   /api/v1/projects        → Create project                             │
│ │   GET    /api/v1/projects        → List user's projects                       │
│ │   GET    /api/v1/projects/:id    → Get project details                        │
│ │   PATCH  /api/v1/projects/:id    → Update project settings                    │
│ │   DELETE /api/v1/projects/:id    → Delete project (owner only)                │
│ │                                                                               │
│ ├─ Team management:                                                              │
│ │   POST   /api/v1/projects/:id/members/invite  → Invite member by email       │
│ │   GET    /api/v1/projects/:id/members         → List members                  │
│ │   PATCH  /api/v1/projects/:id/members/:uid    → Change role (admin+)          │
│ │   DELETE /api/v1/projects/:id/members/:uid    → Remove member (admin+)        │
│ │                                                                               │
│ └─ Acceptance: Multi-user project management works end-to-end                    │
│                                                                                   │
│ Task 3.4: API Infrastructure                                                     │
│ ├─ Next.js API Routes setup with:                                                │
│ │   ├── Request logging (request_id, method, path, duration, status)            │
│ │   ├── Error handling middleware (catch-all with structured errors)             │
│ │   ├── CORS configuration (configurable origins)                               │
│ │   ├── Helmet security headers                                                 │
│ │   ├── Body parser with size limits                                            │
│ │   ├── Health check endpoint: GET /api/health                                  │
│ │   └── API versioning: /api/v1/*                                               │
│ │                                                                               │
│ ├─ Standardized API response format:                                            │
│ │   Success:                                                                    │
│ │   {                                                                           │
│ │     "success": true,                                                          │
│ │     "data": { ... },                                                          │
│ │     "meta": { "page": 1, "per_page": 50, "total": 142 }                      │
│ │   }                                                                           │
│ │   Error:                                                                      │
│ │   {                                                                           │
│ │     "success": false,                                                         │
│ │     "error": {                                                                │
│ │       "code": "VALIDATION_ERROR",                                             │
│ │       "message": "Email is required",                                         │
│ │       "details": [{ "field": "email", "issue": "required" }]                 │
│ │     }                                                                         │
│ │   }                                                                           │
│ │                                                                               │
│ ├─ Validation framework (Zod):                                                  │
│ │   ├── Request body validation middleware                                       │
│ │   ├── Query parameter validation                                              │
│ │   ├── Path parameter validation                                               │
│ │   └── Automatic 400 errors with field-level details                          │
│ │                                                                               │
│ └─ Acceptance: API has consistent format, good errors, pagination works          │
│                                                                                   │
│ Day 3: API Testing & First Deployment                                            │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 3.5: Testing Auth & API                                                     │
│ ├─ Unit tests:                                                                   │
│ │   ├── Password hashing and verification                                       │
│ │   ├── JWT generation and validation                                           │
│ │   └── Role hierarchy checks                                                   │
│ │                                                                               │
│ ├─ Integration tests:                                                            │
│ │   ├── Register → login → access protected route                               │
│ │   ├── Login → refresh token → new access token                                │
│ │   ├── Invalid credentials → 401                                               │
│ │   ├── Valid token for wrong project → 403                                     │
│ │   └── Rate limit enforcement (burst requests → 429)                          │
│ │                                                                               │
│ └─ Acceptance: 100% of auth flows covered by integration tests                  │
│                                                                                   │
│ Task 3.6: First Staging Deployment                                               │
│ ├─ Deploy to Vercel (frontend + API) and Railway (worker)                        │
│ ├─ Run database migrations on production PostgreSQL                              │
│ ├─ Smoke test: health endpoint, register, login                                  │
│ └─ Acceptance: /api/health returns "healthy" on staging                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Phase 3 Deliverables:**

- Full JWT authentication (register, login, refresh, logout, password reset)
- Role-based access control (admin / analyst / viewer)
- Project-level authorization (per-project membership and roles)
- Rate limiting (brute force protection on auth routes)
- Standardized API response format and error handling
- First staging deployment

---

### PHASE 4: AI Prompt Engineering _(Parallel Track)_

**Duration:** 3 days
**When to start:** Simultaneously with Phase 3. Depends only on Phase 1 (shared types and testing framework).
**Objective:** Design, test, and document every AI prompt the pipeline will use before writing any pipeline code. Getting prompts right before wiring them up saves enormous debugging time.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4 DETAIL                                                                   │
│                                                                                   │
│ Day 1: Core Analysis Prompts                                                     │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 4.1: Sentiment & Theme Extraction Prompt                                    │
│ ├─ Design system prompt:                                                         │
│ │   "You are a customer feedback analysis engine for a product team.            │
│ │    You analyze customer reviews with high precision and consistency.           │
│ │    Rules:                                                                      │
│ │    - Always return valid JSON matching the requested schema.                   │
│ │    - Be specific with theme classification. Do not use 'other' unless          │
│ │      truly unclassifiable.                                                    │
│ │    - Sentiment must reflect the overall tone, not just individual sentences.  │
│ │    - Never fabricate information not present in the review.                   │
│ │    - If a review is ambiguous, classify sentiment as 'mixed'."                │
│ │                                                                               │
│ ├─ Design batch analysis prompt (10-20 reviews per call):                       │
│ │   Returns per review:                                                         │
│ │   {                                                                           │
│ │     "review_index": <number>,                                                 │
│ │     "sentiment": "positive" | "negative" | "neutral" | "mixed",              │
│ │     "sentiment_confidence": <0.0 to 1.0>,                                    │
│ │     "theme": "<primary category from taxonomy>",                              │
│ │     "sub_theme": "<specific topic>",                                          │
│ │     "priority": "critical" | "high" | "medium" | "low",                      │
│ │     "priority_reason": "<why this priority>",                                 │
│ │     "key_phrases": ["<phrase1>", "<phrase2>"],                                │
│ │     "summary": "<one sentence summary>",                                      │
│ │     "actionable": true | false,                                               │
│ │     "is_bug": true | false,                                                   │
│ │     "is_feature_request": true | false                                        │
│ │   }                                                                           │
│ │                                                                               │
│ ├─ Theme taxonomy (exhaustive):                                                  │
│ │   "payment"     — checkout, billing, transactions, refunds                    │
│ │   "performance" — speed, crashes, loading, freezing                           │
│ │   "usability"   — navigation, UI confusion, accessibility                    │
│ │   "onboarding"  — signup, setup, first-time experience                        │
│ │   "features"    — feature requests, missing functionality                    │
│ │   "support"     — customer service experience                                 │
│ │   "pricing"     — cost complaints, plan confusion, value perception           │
│ │   "security"    — privacy concerns, data handling, account security           │
│ │   "reliability" — bugs, data loss, unexpected behavior                        │
│ │   "content"     — content quality, relevance, moderation                     │
│ │                                                                               │
│ ├─ Test with 100 labeled reviews across:                                        │
│ │   ├── Different platforms (App Store, Google Play, CSV)                      │
│ │   ├── Different languages (EN, ES, DE, FR, AR)                               │
│ │   ├── Short reviews ("great app", "broken, avoid")                           │
│ │   ├── Long reviews (200+ words)                                              │
│ │   └── Ambiguous reviews (mixed feelings)                                     │
│ ├─ Measure: accuracy (manual comparison), consistency (run same prompt 3x)     │
│ └─ Acceptance: >90% accuracy on labeled test set                                │
│                                                                                   │
│ Task 4.2: Priority Scoring Calibration                                           │
│ ├─ Define priority taxonomy:                                                    │
│ │   critical — data loss, security breach, payment failure, app crash          │
│ │   high     — core feature broken, significant UX degradation                 │
│ │   medium   — inconvenient bug, confusing UX, minor missing feature           │
│ │   low      — cosmetic issue, minor inconvenience, general praise             │
│ │                                                                               │
│ ├─ Test calibration:                                                            │
│ │   ├── 20 obvious critical reviews → all marked critical                      │
│ │   ├── 20 obvious low reviews → all marked low                                │
│ │   └── 20 ambiguous reviews → manual review of each classification            │
│ └─ Acceptance: Priority distribution matches expected (5% critical, 20% high)   │
│                                                                                   │
│ Day 2: Advanced Prompts (Summaries & RAG)                                        │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 4.3: Insight Summary Prompt                                                  │
│ ├─ Design cluster/theme summary prompt:                                          │
│ │   "You are analyzing a group of customer reviews about {theme}.               │
│ │    Here are representative reviews from the last {date_range}:               │
│ │    {reviews_text}                                                              │
│ │    Generate a summary with:                                                   │
│ │    {                                                                          │
│ │      "title": "concise summary (5 words max)",                               │
│ │      "executive_summary": "2-3 sentence overview for a product leader",      │
│ │      "top_issues": [{"issue": "...", "frequency": "...",                     │
│ │                       "example_quotes": [...],                                │
│ │                       "recommended_action": "..."}],                          │
│ │      "trend": "improving" | "worsening" | "stable",                          │
│ │      "trend_evidence": "<reasoning>"                                          │
│ │    }"                                                                         │
│ │                                                                               │
│ ├─ Test with real cluster data (20-50 reviews per cluster)                      │
│ ├─ Evaluate: actionability, accuracy, tone (professional, not alarmist)         │
│ └─ Acceptance: Summary is actionable and accurate                               │
│                                                                                   │
│ Task 4.4: RAG Prompt for AI Chat                                                 │
│ ├─ Design RAG system prompt:                                                    │
│ │   "You are an AI assistant for a product team. You analyze                   │
│ │    customer reviews and provide insights. Answer questions based ONLY         │
│ │    on the provided review data. If the data doesn't contain enough            │
│ │    information, say so. Always cite specific reviews when possible.           │
│ │    Be concise and actionable."                                                │
│ │                                                                               │
│ ├─ Design retrieval strategy:                                                    │
│ │   ├── Embed user question                                                    │
│ │   ├── Find top-20 most similar reviews (semantic search)                     │
│ │   ├── Filter by user-specified constraints (platform, date, etc.)            │
│ │   ├── Include review metadata in context (platform, rating, date, sentiment) │
│ │   └── Token budget management (truncate if >6K tokens in context)            │
│ │                                                                               │
│ ├─ Test with 20 realistic questions:                                            │
│ │   "What are customers saying about the checkout process?"                    │
│ │   "Why are people leaving 1-star reviews this week?"                         │
│ │   "Is the new update causing more complaints?"                               │
│ │   "What features are customers requesting most?"                             │
│ │                                                                               │
│ ├─ Evaluate: answer accuracy, citation quality, hallucination rate              │
│ └─ Acceptance: >85% of answers are factually grounded in the review data        │
│                                                                                   │
│ Day 3: Optimization & Documentation                                              │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 4.5: Cost & Performance Optimization                                        │
│ ├─ Benchmark models on the same test set:                                       │
│ │   ├── claude-haiku-4-5: accuracy, latency, cost (cheapest)                  │
│ │   ├── claude-sonnet-4-5: accuracy, latency, cost (primary choice)           │
│ │   └── Identify if Haiku is good enough for batch analysis to reduce cost    │
│ ├─ Validate batch processing:                                                   │
│ │   ├── Does quality degrade with 10-review batches vs 1-review?              │
│ │   ├── Does quality degrade with 20-review batches vs 10-review?             │
│ │   └── Find the optimal batch size (quality × cost tradeoff)                 │
│ ├─ Design structured output format (JSON mode)                                  │
│ ├─ Test response parsing robustness (what if LLM returns malformed JSON?)       │
│ └─ Acceptance: Documented cost per 1,000 reviews, model selection decision      │
│                                                                                   │
│ Task 4.6: Prompt Library Documentation                                           │
│ ├─ Create /packages/ai/prompts/ directory with:                                 │
│ │   ├── batch-analysis.prompt.ts      (system + user templates)                │
│ │   ├── insight-summary.prompt.ts                                               │
│ │   └── rag-chat.prompt.ts                                                     │
│ ├─ Each file includes:                                                          │
│ │   ├── Template with variable placeholders                                    │
│ │   ├── Expected input schema (Zod)                                            │
│ │   ├── Expected output schema (Zod)                                           │
│ │   ├── Model recommendation and parameters                                    │
│ │   ├── Known failure modes                                                    │
│ │   └── Test examples with expected outputs                                    │
│ └─ Acceptance: Every prompt is testable, documented, and version-controlled     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Phase 4 Deliverables:**

- Tested batch analysis prompt (sentiment, theme, priority, summary in one call)
- Tested insight summary prompt (cluster/theme level summaries)
- Tested RAG prompt (AI chat with source citations)
- Prompt library in `/packages/ai/prompts/`
- Documented cost-per-1000-reviews for selected model and batch size

---

### PHASE 5: Review Ingestion & Upload Module

**Duration:** 3 days
**Objective:** Multiple paths for reviews to enter the system — CSV upload, platform connectors, and manual entry — all normalizing to the canonical internal format.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5 DETAIL                                                                   │
│                                                                                   │
│ Day 1: CSV Upload System                                                         │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 5.1: CSV Upload API                                                         │
│ ├─ POST /api/v1/projects/:id/reviews/upload                                      │
│ │   ├── Accept: multipart/form-data (file upload)                               │
│ │   ├── Validate file:                                                          │
│ │   │   ├── Max size: 50MB                                                      │
│ │   │   ├── Type: .csv or .json                                                 │
│ │   │   ├── Encoding: UTF-8 detection and conversion                           │
│ │   │   └── Max rows: 50,000 per upload                                        │
│ │   ├── Parse file (streaming for large files):                                │
│ │   │   ├── CSV: Papa Parse with header detection                              │
│ │   │   ├── JSON: JSON stream parser for large files                           │
│ │   │   └── Auto-detect column mapping:                                        │
│ │   │       "review" / "content" / "text" / "comment" → review_text            │
│ │   │       "rating" / "stars" / "score"              → rating                 │
│ │   │       "date" / "timestamp" / "created_at"       → review_date            │
│ │   │       "author" / "user" / "name"                → author_name            │
│ │   │       "title" / "subject"                       → review_title           │
│ │   ├── Validate each row:                                                     │
│ │   │   ├── Required: review_text (non-empty string)                           │
│ │   │   ├── Optional: rating (1-5), date, author, title                        │
│ │   │   ├── Invalid rows collected separately (not blocking)                   │
│ │   │   └── Deduplicate against existing reviews (content hash)                │
│ │   ├── Store valid reviews in PostgreSQL (status = 'pending')                  │
│ │   ├── Create upload_batch record                                              │
│ │   ├── Return 202 Accepted with:                                              │
│ │   │   {                                                                      │
│ │   │     "batch_id": "...",                                                   │
│ │   │     "total_rows": 1500,                                                  │
│ │   │     "valid": 1423,                                                       │
│ │   │     "invalid": 47,                                                       │
│ │   │     "duplicates": 30,                                                    │
│ │   │     "errors": [                                                          │
│ │   │       { "row": 45, "issue": "empty content" },                          │
│ │   │       { "row": 102, "issue": "invalid rating: 'six'" }                  │
│ │   │     ],                                                                   │
│ │   │     "estimated_processing_time": "~12 minutes"                          │
│ │   │   }                                                                      │
│ │   └── Enqueue batch for AI processing                                        │
│ │                                                                               │
│ └─ Acceptance: Upload 1000-row CSV, get accurate summary, reviews stored        │
│                                                                                   │
│ Task 5.2: Column Mapping UI                                                      │
│ ├─ If auto-detection is ambiguous:                                               │
│ │   Show preview of first 5 rows                                                │
│ │   Let user map columns: review_text, rating, date, author, title             │
│ │   Save mapping as template for future uploads from same source                │
│ └─ Acceptance: User can manually map columns when auto-detection fails          │
│                                                                                   │
│ Day 2: Platform Connector Framework                                              │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 5.3: Connector Architecture                                                 │
│ ├─ Abstract connector interface:                                                │
│ │   interface PlatformConnector {                                               │
│ │     platform: string                                                          │
│ │     connect(config: SourceConfig): Promise<void>                              │
│ │     disconnect(): Promise<void>                                               │
│ │     fetchReviews(options: FetchOptions): Promise<RawReview[]>                 │
│ │     getHealthStatus(): Promise<HealthStatus>                                  │
│ │     getRateLimit(): RateLimitInfo                                             │
│ │   }                                                                           │
│ │                                                                               │
│ ├─ Implement connector registry:                                                │
│ │   connectorRegistry.register('appstore', new AppStoreConnector())             │
│ │   connectorRegistry.get('appstore').fetchReviews(...)                         │
│ │                                                                               │
│ └─ Acceptance: New connector can be added by implementing one interface          │
│                                                                                   │
│ Task 5.4: App Store Connect Connector                                            │
│ ├─ Use App Store Connect API                                                     │
│ ├─ Handle authentication, pagination, rate limiting, and retry                  │
│ ├─ Normalize to canonical review format                                         │
│ ├─ Store last sync cursor for incremental fetches                               │
│ └─ Acceptance: Can fetch and store real App Store reviews                        │
│                                                                                   │
│ Task 5.5: Google Play Connector                                                  │
│ ├─ Use google-play-scraper npm package                                           │
│ ├─ Same patterns as App Store connector                                         │
│ └─ Acceptance: Can fetch and store real Google Play reviews                      │
│                                                                                   │
│ Day 3: Sync Engine & Review Query API                                            │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 5.6: Background Sync Engine                                                 │
│ ├─ Sync scheduler:                                                               │
│ │   ├── Check all active project sources on a schedule                         │
│ │   ├── For each source: fetch new reviews since last sync                     │
│ │   ├── Normalize + deduplicate + store                                         │
│ │   ├── Update sync timestamps and review counts                               │
│ │   ├── Enqueue reviews for AI analysis                                        │
│ │   ├── Handle errors gracefully (don't crash entire scheduler)                │
│ │   └── Log sync results (fetched, new, errors, duration)                      │
│ │                                                                               │
│ ├─ Manual sync trigger:                                                          │
│ │   POST /api/v1/projects/:id/sources/:sid/sync                                 │
│ │   ├── Queue sync job (BullMQ)                                                │
│ │   └── Return: { "job_id": "...", "status": "queued" }                        │
│ │                                                                               │
│ └─ Acceptance: Sources sync on schedule, manual trigger works, errors logged     │
│                                                                                   │
│ Task 5.7: Review Query API                                                       │
│ ├─ GET /api/v1/projects/:id/reviews                                              │
│ │   ├── Cursor-based pagination (50 per page default, max 200)                 │
│ │   ├── Filters (all combinable):                                              │
│ │   │   ├── sentiment, theme, priority, source, rating                         │
│ │   │   ├── date_from, date_to                                                 │
│ │   │   ├── search (full-text on review_text)                                  │
│ │   │   ├── is_bug, is_feature_request, actionable                             │
│ │   │   └── processing_status                                                  │
│ │   └── Sort: review_date, priority, rating (asc/desc)                        │
│ │                                                                               │
│ ├─ GET /api/v1/projects/:id/reviews/:reviewId                                    │
│ │   └── Full review detail with all AI analysis fields                          │
│ │                                                                               │
│ └─ Acceptance: All filters work, pagination is performant, search is fast        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Phase 5 Deliverables:**

- CSV/JSON upload with validation, error reporting, and column auto-mapping
- App Store and Google Play connectors
- Abstract connector framework (easy to add new platforms)
- Background sync engine with scheduling and error handling
- Review list API with comprehensive filtering and pagination

---

### PHASE 6: AI Pipeline Integration

**Duration:** 4 days
**Objective:** Wire the AI prompts from Phase 4 into a production pipeline that processes reviews automatically, reliably, and cost-effectively.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6 DETAIL                                                                   │
│                                                                                   │
│ Day 1: Pipeline Infrastructure                                                   │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 6.1: AI Orchestrator                                                        │
│ ├─ Build pipeline orchestrator:                                                  │
│ │   class ReviewPipeline {                                                      │
│ │     async process(review: Review): Promise<AnalysisResult>                    │
│ │     async processBatch(reviews: Review[]): Promise<AnalysisResult[]>          │
│ │     async reprocessProject(projectId: string): Promise<void>                  │
│ │   }                                                                           │
│ │                                                                               │
│ ├─ 4-stage pipeline (BullMQ queues):                                             │
│ │   Stage 1 (parse-queue):   Clean text, detect language, validate             │
│ │   Stage 2 (analyze-queue): Claude API batch analysis (10-15 reviews/call)    │
│ │   Stage 3 (embed-queue):   Generate embeddings, store in ChromaDB            │
│ │   Stage 4 (insight-queue): Update analytics, generate insights, SSE notify   │
│ │                                                                               │
│ ├─ Worker concurrency:                                                           │
│ │   parse-queue:    concurrency = 10  (CPU-bound, fast)                        │
│ │   analyze-queue:  concurrency = 5   (API-bound, rate-limited by Claude)      │
│ │   embed-queue:    concurrency = 5   (API-bound, Voyage AI)                   │
│ │   insight-queue:  concurrency = 2   (heavy aggregation)                      │
│ │                                                                               │
│ ├─ Error handling per stage:                                                     │
│ │   ├── Retry: 3 attempts with exponential backoff (1s, 4s, 16s)              │
│ │   ├── Partial failure: store what succeeds, mark failed stages for retry     │
│ │   └── Dead letter: after 3 failures, mark as 'failed', log for inspection   │
│ │                                                                               │
│ └─ Acceptance: Pipeline processes review end-to-end with all 4 stages           │
│                                                                                   │
│ Task 6.2: LLM Client Abstraction                                                 │
│ ├─ Build provider-agnostic LLM client:                                          │
│ │   interface LLMClient {                                                      │
│ │     chat(messages: Message[], opts: ChatOptions): Promise<ChatResponse>       │
│ │     embed(text: string): Promise<number[]>                                   │
│ │     embedBatch(texts: string[]): Promise<number[][]>                         │
│ │   }                                                                           │
│ │                                                                               │
│ ├─ Implementations:                                                              │
│ │   ├── AnthropicClient (primary: claude-sonnet-4-5)                           │
│ │   ├── VoyageClient (primary embeddings: voyage-3)                            │
│ │   ├── OpenAIEmbeddingClient (fallback: text-embedding-3-small)               │
│ │   └── MockClient (deterministic responses for testing)                       │
│ │                                                                               │
│ ├─ Features:                                                                     │
│ │   ├── Automatic retry with provider fallback                                 │
│ │   ├── Token counting for budget management                                   │
│ │   ├── Request logging (model, tokens, latency, cost estimate)                │
│ │   └── Rate limiting (respect provider limits)                                │
│ │                                                                               │
│ └─ Acceptance: Can swap models with config change, no code changes              │
│                                                                                   │
│ Day 2: Embedding & Vector Storage                                                │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 6.3: Embedding Generation & ChromaDB Integration                            │
│ ├─ Generate embeddings for processed reviews using Voyage AI voyage-3            │
│ ├─ Batch optimization: group 100 texts per API call                             │
│ ├─ Store embeddings in ChromaDB with metadata filters:                          │
│ │   ├── project_id (for project-level isolation)                               │
│ │   ├── sentiment, theme, priority (for pre-filtered search)                   │
│ │   └── review_date (for date-range filtering)                                 │
│ ├─ Store ChromaDB document ID back on the PostgreSQL review record              │
│ ├─ Handle embedding failures gracefully (retry, don't block pipeline)           │
│ └─ Acceptance: 1,000 reviews embedded and vector-searchable in <2 minutes       │
│                                                                                   │
│ Task 6.4: Semantic Search                                                        │
│ ├─ POST /api/v1/projects/:id/reviews/search                                      │
│ │   ├── Accept: natural language query + optional filters                      │
│ │   ├── Embed query using same model as stored embeddings                      │
│ │   ├── Vector similarity search in ChromaDB (top-50 candidates)               │
│ │   ├── Apply additional filters (sentiment, priority, date range)             │
│ │   ├── Re-rank by relevance (combine similarity + recency + priority)         │
│ │   └── Return: ranked reviews with similarity scores                          │
│ │                                                                               │
│ ├─ GET /api/v1/projects/:id/reviews/:reviewId/similar                            │
│ │   └── Return top-10 most similar reviews (same project, excluding self)      │
│ │                                                                               │
│ └─ Acceptance: "payment issues" query returns relevant reviews, not keyword match│
│                                                                                   │
│ Day 3: AI Chat Assistant (RAG)                                                   │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 6.5: RAG Engine                                                             │
│ ├─ POST /api/v1/projects/:id/chat/sessions/:sid/messages                         │
│ │   ├── Accept: { message, context_filters? }                                  │
│ │   ├── Step 1: Embed user question                                            │
│ │   ├── Step 2: Retrieve top-20 relevant reviews (ChromaDB + filters)          │
│ │   ├── Step 3: Assemble context (reviews + metadata, token-budgeted)          │
│ │   ├── Step 4: Call Claude with RAG prompt                                    │
│ │   ├── Step 5: Return { answer, source_reviews, confidence }                  │
│ │   └── Step 6: Persist message to chat_messages table                         │
│ │                                                                               │
│ ├─ Conversation context:                                                         │
│ │   ├── Include last 5 Q&A pairs from session for continuity                  │
│ │   └── Clear conversation context after 30 min inactivity                     │
│ │                                                                               │
│ ├─ Grounding & safety:                                                           │
│ │   ├── Model instructed to cite real reviews only                             │
│ │   ├── "I don't know" response when data is insufficient                     │
│ │   └── Flag answers that don't match source context                          │
│ │                                                                               │
│ └─ Acceptance: AI answers questions accurately, cites real reviews              │
│                                                                                   │
│ Day 4: Insight Generation & Summary Engine                                       │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 6.6: Insight Aggregation                                                    │
│ ├─ Insight generation triggers:                                                  │
│ │   ├── After batch processing completes                                       │
│ │   ├── On significant sentiment shift (>10% change in 24h)                   │
│ │   ├── Weekly scheduled generation (Monday 9am)                               │
│ │   └── Manual trigger via API                                                 │
│ │                                                                               │
│ ├─ Process:                                                                      │
│ │   ├── Aggregate reviews by theme for the period                              │
│ │   ├── Sample 20-30 representative reviews per theme                         │
│ │   ├── Call Claude with insight summary prompt                                │
│ │   ├── Store structured insight in insights table                             │
│ │   └── Emit SSE event to connected dashboard clients                          │
│ │                                                                               │
│ └─ Acceptance: Insights are generated, surfaced, and accurate                   │
│                                                                                   │
│ Task 6.7: SSE Progress Events                                                    │
│ ├─ GET /api/v1/projects/:id/events                                               │
│ │   Events emitted:                                                             │
│ │   ├── review.processing_progress  { batch_id, processed, total, pct }        │
│ │   ├── review.batch_completed      { batch_id, total_reviews, summary }       │
│ │   ├── insight.generated           { insight_id, type, title, severity }      │
│ │   └── analysis.trend_detected     { theme, direction, details }              │
│ │                                                                               │
│ └─ Acceptance: Uploading CSV shows live progress in browser without polling     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Phase 6 Deliverables:**

- Complete AI pipeline (4 stages, BullMQ workers, error recovery)
- Embedding generation with Voyage AI + ChromaDB storage
- Semantic search across all project reviews
- RAG-based AI chat assistant with source citations
- Insight aggregation engine with scheduled generation
- Server-Sent Events for real-time pipeline progress
- LLM client abstraction with fallback and cost tracking

---

### PHASE 7: Analytics Engine & API

**Duration:** 3 days
**Objective:** Pre-computed analytics that power fast dashboard queries. Not raw database scans on every page load.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 7 DETAIL                                                                   │
│                                                                                   │
│ Day 1: Analytics Computation Engine                                              │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 7.1: Analytics Snapshot Generator                                           │
│ ├─ Scheduled computation (BullMQ cron):                                          │
│ │   ├── Hourly: real-time counters for live dashboards                         │
│ │   ├── Daily (2am): full daily snapshot                                        │
│ │   ├── Weekly (Monday 3am): weekly aggregation                                │
│ │   └── Monthly (1st of month 4am): monthly aggregation                        │
│ │                                                                               │
│ ├─ Computed metrics per snapshot:                                                │
│ │   ├── Total reviews (new vs. previous period)                                │
│ │   ├── Sentiment distribution (count + percentage)                            │
│ │   ├── Average rating (time series)                                           │
│ │   ├── Priority distribution (critical/high/medium/low)                       │
│ │   ├── Top 10 themes with counts and trend direction                          │
│ │   ├── Source breakdown (reviews per source)                                  │
│ │   ├── Language breakdown                                                      │
│ │   └── AI processing stats (success rate, avg latency, cost per review)      │
│ │                                                                               │
│ ├─ Store in analytics_daily table                                                │
│ ├─ Cache hot queries in Redis (TTL: 60s for hourly, 1h for daily)               │
│ └─ Acceptance: Snapshots generated on schedule, cached appropriately            │
│                                                                                   │
│ Day 2: Analytics APIs                                                            │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 7.2: Dashboard Overview API                                                 │
│ ├─ GET /api/v1/projects/:id/analytics/overview                                   │
│ │   ├── Returns:                                                                │
│ │   │   {                                                                       │
│ │   │     "total_reviews": 4523,                                                │
│ │   │     "reviews_change_pct": +12.3,                                          │
│ │   │     "avg_rating": 3.4,                                                    │
│ │   │     "rating_change": -0.3,                                                │
│ │   │     "sentiment_breakdown": {                                              │
│ │   │        "positive": 1823, "negative": 1456,                               │
│ │   │        "neutral": 890,   "mixed": 354                                    │
│ │   │     },                                                                    │
│ │   │     "top_themes": [                                                       │
│ │   │        { "theme": "payment", "count": 876, "trend": "worsening" }        │
│ │   │     ],                                                                    │
│ │   │     "critical_issues": 23,                                                │
│ │   │     "reviews_today": 127,                                                 │
│ │   │     "processing_queue_depth": 0                                           │
│ │   │   }                                                                       │
│ │   ├── Cached: 60 seconds                                                     │
│ │   └── Filtered by: ?range=7d|30d|90d|custom                                  │
│ │                                                                               │
│ └─ Acceptance: Dashboard loads in <500ms including cache hit                    │
│                                                                                   │
│ Task 7.3: Time-Series Analytics APIs                                             │
│ ├─ GET /api/v1/projects/:id/analytics/trends?granularity=day&from=...&to=...    │
│ │   └── Returns: [{ date, positive, neutral, negative, mixed, avg_rating }]    │
│ │                                                                               │
│ ├─ GET /api/v1/projects/:id/analytics/themes?from=...&to=...&sort=count|trend   │
│ │   └── Returns: [{ theme, count, trend, avg_priority, sample_reviews }]       │
│ │                                                                               │
│ ├─ GET /api/v1/projects/:id/analytics/priority?from=...&to=...                  │
│ │   └── Returns: [{ date, critical, high, medium, low }]                      │
│ │                                                                               │
│ ├─ GET /api/v1/projects/:id/analytics/sources?from=...&to=...                   │
│ │   └── Returns: [{ source, review_count, avg_rating, avg_sentiment }]         │
│ │                                                                               │
│ └─ Acceptance: All time-series APIs return correct data and are performant      │
│                                                                                   │
│ Day 3: Export & On-Demand Analytics                                              │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 7.4: Export System                                                          │
│ ├─ POST /api/v1/projects/:id/analytics/export                                    │
│ │   ├── Request: { format: "csv" | "pdf", date_range, filters, sections[] }    │
│ │   ├── Queue export job (BullMQ)                                              │
│ │   └── Return: { job_id, status: "queued" }                                   │
│ │                                                                               │
│ ├─ GET /api/v1/projects/:id/analytics/export/:jobId                              │
│ │   └── Returns: { status, download_url (when ready), progress_pct }           │
│ │                                                                               │
│ ├─ CSV export: all reviews + AI analysis fields, streaming for large datasets   │
│ ├─ PDF export: executive summary, sentiment charts, top themes, insights        │
│ └─ Acceptance: CSV and PDF exports generate correctly, stored in S3             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Phase 7 Deliverables:**

- Pre-computed analytics snapshots (hourly, daily, weekly, monthly)
- Dashboard overview API with Redis caching
- Time-series APIs for sentiment, themes, priority, and sources
- CSV and PDF export with async job queue

---

### PHASE 8: Frontend Dashboard & User Experience

**Duration:** 5 days
**Objective:** A polished, data-rich dashboard that product teams actually want to use daily. Not a generic admin panel — a purpose-built review intelligence tool.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 8 DETAIL                                                                   │
│                                                                                   │
│ Day 1: App Shell, Auth Pages, Navigation                                         │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 8.1: App Layout & Navigation                                                │
│ ├─ Layout structure:                                                             │
│ │   ┌──────────────────────────────────────────────────────────────┐            │
│ │   │  ┌─────────┐ ┌────────────────────────────────────────────┐ │            │
│ │   │  │         │ │  Top Bar (search, notifications, profile)  │ │            │
│ │   │  │  Side   │ ├────────────────────────────────────────────┤ │            │
│ │   │  │  Nav    │ │                                            │ │            │
│ │   │  │         │ │                                            │ │            │
│ │   │  │ • Dash  │ │            Main Content Area               │ │            │
│ │   │  │ • Revs  │ │                                            │ │            │
│ │   │  │ • Insgt │ │                                            │ │            │
│ │   │  │ • AI    │ │                                            │ │            │
│ │   │  │ • Set   │ │                                            │ │            │
│ │   │  └─────────┘ └────────────────────────────────────────────┘ │            │
│ │   └──────────────────────────────────────────────────────────────┘            │
│ │                                                                               │
│ ├─ Sidebar: collapsible, icon-only mode on smaller screens                      │
│ ├─ Active route highlighting                                                   │
│ ├─ Breadcrumb navigation for deep pages                                        │
│ └─ Acceptance: Navigation works on desktop and tablet                           │
│                                                                                   │
│ Task 8.2: Auth Pages                                                             │
│ ├─ Login page (email + password)                                                │
│ ├─ Registration page (name, email, password)                                    │
│ ├─ Forgot password / Reset password pages                                       │
│ ├─ Email verification page                                                      │
│ └─ Acceptance: Full auth flow works in browser                                  │
│                                                                                   │
│ Day 2: Overview Dashboard                                                       │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 8.3: Overview Dashboard                                                     │
│ ├─ Metric cards (top row):                                                      │
│ │   ├── Total Reviews (with % change vs previous period)                       │
│ │   ├── Average Rating (with sparkline)                                        │
│ │   ├── Sentiment Score (with distribution bar)                                │
│ │   └── AI Queue Status (processing / processed / failed)                      │
│ │                                                                               │
│ ├─ Sentiment Trend Chart (main, large):                                         │
│ │   ├── Line chart: positive / neutral / negative over time                    │
│ │   ├── Time range selector: 7d, 30d, 90d, custom                             │
│ │   ├── Hover tooltip with exact values                                        │
│ │   └── Click-through to filtered reviews for any point                        │
│ │                                                                               │
│ ├─ Theme Breakdown (side panel):                                                │
│ │   ├── Horizontal bar chart: top 10 themes by frequency                       │
│ │   ├── Trend indicator per theme (worsening / stable / improving)             │
│ │   └── Click-through to filtered theme view                                   │
│ │                                                                               │
│ ├─ Rating Distribution:                                                         │
│ │   └── Star rating bar chart (1-5) with period comparison                    │
│ │                                                                               │
│ ├─ Source Breakdown:                                                             │
│ │   └── Donut chart: review count per source with avg sentiment                │
│ │                                                                               │
│ ├─ Recent Insights Feed:                                                         │
│ │   └── Latest AI-generated insights with severity badge                       │
│ │                                                                               │
│ └─ Acceptance: Dashboard loads in <2s, charts are interactive, data is accurate │
│                                                                                   │
│ Day 3: Reviews Page                                                              │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 8.4: Reviews List Page                                                      │
│ ├─ Filter sidebar:                                                              │
│ │   ├── Sentiment: multi-select                                                 │
│ │   ├── Source: multi-select                                                    │
│ │   ├── Priority: multi-select                                                  │
│ │   ├── Rating: range slider (1-5)                                             │
│ │   ├── Theme: search + select                                                 │
│ │   ├── Date range: date picker                                                │
│ │   └── Apply / Clear buttons                                                  │
│ │                                                                               │
│ ├─ Search bar:                                                                  │
│ │   ├── Full-text search (keyword mode)                                        │
│ │   └── Toggle: keyword search vs semantic search                              │
│ │                                                                               │
│ ├─ Review cards:                                                                 │
│ │   ├── Review text (truncated, expandable)                                    │
│ │   ├── Source badge + rating stars                                             │
│ │   ├── Sentiment label with color coding                                      │
│ │   ├── Theme tags + priority badge                                            │
│ │   ├── Author + date                                                          │
│ │   └── Click → full review detail side panel                                  │
│ │                                                                               │
│ ├─ Pagination with cursor                                                        │
│ ├─ Sort: newest, oldest, highest priority, lowest rating                        │
│ └─ Acceptance: Can filter through 10K+ reviews with <1s response time           │
│                                                                                   │
│ Day 4: Insights & AI Chat Pages                                                  │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 8.5: Insights Page                                                          │
│ ├─ Insights list with:                                                          │
│ │   ├── Insight title + type badge (theme_summary, trend_alert, weekly)        │
│ │   ├── Severity indicator                                                     │
│ │   ├── Date range covered                                                     │
│ │   ├── Read / Dismiss actions                                                 │
│ │   └── Click → detail page with full AI-generated analysis                   │
│ ├─ Filter by: type, severity, date, theme                                       │
│ └─ Acceptance: Insights are browsable and actionable                            │
│                                                                                   │
│ Task 8.6: AI Chat Page                                                           │
│ ├─ Chat interface:                                                              │
│ │   ├── Message input with placeholder suggestions                             │
│ │   ├── Conversation history (scrollable)                                      │
│ │   ├── AI responses with source citations                                     │
│ │   │   └── Citations show review snippet + link to full review                │
│ │   ├── Suggested follow-up questions                                          │
│ │   └── Streaming text with loading indicator                                  │
│ │                                                                               │
│ ├─ Suggested starter questions (empty state):                                   │
│ │   "What are the top complaints this week?"                                   │
│ │   "Why are users leaving 1-star reviews?"                                    │
│ │   "What features are most requested?"                                        │
│ │   "How does sentiment compare across sources?"                               │
│ │                                                                               │
│ ├─ Context filters:                                                             │
│ │   └── Filter AI to a specific source, date range, or sentiment               │
│ │                                                                               │
│ └─ Acceptance: AI gives accurate, cited answers; streaming works                │
│                                                                                   │
│ Day 5: Settings & UX Polish                                                      │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 8.7: Settings Pages                                                         │
│ ├─ Source management:                                                           │
│ │   ├── Connected sources list with sync status                                │
│ │   ├── Add source wizard (select platform → configure → test → connect)       │
│ │   └── Disconnect source + sync history                                       │
│ │                                                                               │
│ ├─ Team management:                                                             │
│ │   ├── Member list with roles                                                 │
│ │   ├── Invite member form                                                     │
│ │   ├── Change role dropdown                                                   │
│ │   └── Remove member                                                          │
│ │                                                                               │
│ ├─ Profile:                                                                     │
│ │   ├── Edit name, email                                                       │
│ │   ├── Change password                                                        │
│ │   └── Notification preferences                                               │
│ │                                                                               │
│ └─ Acceptance: All settings functional                                          │
│                                                                                   │
│ Task 8.8: UX Polish                                                              │
│ ├─ Loading states: skeleton loaders (not spinners)                              │
│ ├─ Empty states: helpful messages + clear call-to-action                        │
│ ├─ Error states: friendly messages + retry buttons                              │
│ ├─ Responsive design: optimized for 1280px, 1920px, tablet                     │
│ ├─ Keyboard shortcuts: / for search, Esc to close panels                        │
│ ├─ Accessibility: ARIA labels, keyboard navigation, color contrast              │
│ ├─ Performance: lazy-load charts, virtualize long review lists                  │
│ └─ Acceptance: Product feels polished, not prototype-y                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Phase 8 Deliverables:**

- Complete Next.js frontend with all major pages
- Overview dashboard with interactive charts
- Review list with semantic and keyword search
- Insights page with AI-generated summaries
- AI Chat interface with streaming and citations
- Settings (sources, team, profile)
- Polished UX (loading states, empty states, accessibility)

---

### PHASE 9: Testing, Hardening & Production Deployment

**Duration:** 4 days
**Objective:** Make it production-ready. Not "it works on my machine" — "it works under load, handles failures, and recovers gracefully."

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 9 DETAIL                                                                   │
│                                                                                   │
│ Day 1: Comprehensive Testing                                                     │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 9.1: Integration Test Suite                                                 │
│ ├─ Auth flow tests:                                                              │
│ │   ├── Register → verify email → login → access protected route               │
│ │   ├── Login → use access token → refresh → use new token → logout            │
│ │   ├── Password reset end-to-end                                               │
│ │   └── Team invite → accept → role change → remove                            │
│ │                                                                               │
│ ├─ Review lifecycle tests:                                                       │
│ │   ├── Upload CSV → reviews stored → AI processes → results visible           │
│ │   ├── Semantic search returns relevant results (not keyword matches)          │
│ │   └── Insights generated after processing completes                          │
│ │                                                                               │
│ ├─ AI pipeline tests:                                                            │
│ │   ├── Review processed → all 4 stages complete → embedding in ChromaDB      │
│ │   ├── Insight triggered and generated when threshold reached                 │
│ │   └── RAG assistant returns grounded, cited answers                          │
│ │                                                                               │
│ ├─ Analytics tests:                                                              │
│ │   ├── Overview API returns correct aggregations                              │
│ │   ├── Time-series data matches raw review data                               │
│ │   └── Export generates valid CSV and PDF                                     │
│ │                                                                               │
│ └─ Acceptance: All integration tests pass                                       │
│                                                                                   │
│ Task 9.2: Edge Case & Error Handling Tests                                       │
│ ├─ Upload edge cases:                                                            │
│ │   ├── Empty CSV                                                               │
│ │   ├── CSV with 50,000 rows                                                    │
│ │   ├── Malformed CSV (missing columns, bad encoding)                          │
│ │   ├── Reviews with only emoji                                                 │
│ │   ├── Reviews in Arabic, Chinese, Japanese                                    │
│ │   ├── Reviews with 5000+ characters                                          │
│ │   └── Duplicate uploads (same file twice)                                    │
│ │                                                                               │
│ ├─ AI pipeline failure scenarios:                                                │
│ │   ├── Claude API 429 (rate limit) → retries, eventually succeeds            │
│ │   ├── Claude API 500 → retries, marks failed after max attempts             │
│ │   ├── Claude returns malformed JSON → parse failure handled gracefully       │
│ │   ├── Voyage AI embedding fails → review stored, embedding queued for retry  │
│ │   └── ChromaDB unavailable → graceful degradation, queue resume on recovery  │
│ │                                                                               │
│ ├─ Project isolation:                                                            │
│ │   ├── Project A user cannot access Project B's reviews                       │
│ │   ├── Project A's AI analysis does not surface Project B's themes            │
│ │   └── SSE events scoped correctly to project                                 │
│ │                                                                               │
│ └─ Acceptance: System handles all edge cases without crashing or data leaks     │
│                                                                                   │
│ Day 2: Performance & Load Testing                                                │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 9.3: Performance Benchmarks                                                 │
│ ├─ API response time targets:                                                   │
│ │   ├── GET /api/v1/projects/:id/reviews (paginated):   <500ms                │
│ │   ├── GET /api/v1/projects/:id/analytics/overview:    <1s                   │
│ │   ├── POST /api/v1/projects/:id/reviews/search:        <2s                   │
│ │   ├── POST /api/v1/projects/:id/chat/.../messages:     <3s (first token)    │
│ │   └── POST /api/v1/projects/:id/reviews/upload (1K rows): <10s              │
│ │                                                                               │
│ ├─ Load test (k6 or Artillery):                                                 │
│ │   ├── 50 concurrent users browsing dashboard                                │
│ │   ├── 10 concurrent CSV uploads (1,000 rows each)                           │
│ │   ├── 20 concurrent semantic searches                                        │
│ │   └── Mixed workload simulating real usage                                   │
│ │                                                                               │
│ ├─ Database query optimization:                                                  │
│ │   ├── EXPLAIN ANALYZE on all critical queries                                │
│ │   ├── Add missing indexes where identified                                   │
│ │   └── Connection pool tuning                                                 │
│ │                                                                               │
│ └─ Acceptance: All response time targets met under simulated load               │
│                                                                                   │
│ Task 9.4: AI Pipeline Performance                                                │
│ ├─ Throughput benchmark:                                                         │
│ │   ├── Process 5,000 reviews end-to-end                                       │
│ │   ├── Measure: total time, avg time per review, cost per review              │
│ │   ├── Compare batch size 10 vs 15 vs 20                                     │
│ │   └── Identify bottlenecks (Claude latency? DB writes? Embeddings?)          │
│ │                                                                               │
│ ├─ Cost projection:                                                              │
│ │   ├── Cost per 1,000 reviews (analysis + embedding)                          │
│ │   ├── Cost per chat message                                                  │
│ │   └── Monthly cost projection at 10K, 50K, 100K reviews/month               │
│ │                                                                               │
│ └─ Acceptance: Documented performance and cost characteristics                  │
│                                                                                   │
│ Day 3: Security Hardening & Monitoring                                           │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 9.5: Security Audit                                                         │
│ ├─ OWASP Top 10 checklist:                                                      │
│ │   ├── Injection: parameterized queries (ORM enforces), input validation      │
│ │   ├── Broken Auth: JWT expiry, refresh rotation, brute force protection      │
│ │   ├── Sensitive Data: no passwords/keys in logs, PII redaction               │
│ │   ├── Broken Access Control: project-level RBAC on every endpoint            │
│ │   ├── Misconfig: no debug mode in prod, no default credentials               │
│ │   ├── XSS: CSP headers, output encoding                                      │
│ │   ├── Vulnerable Components: npm audit, Snyk scan                           │
│ │   └── Logging: audit trail for sensitive operations                          │
│ │                                                                               │
│ ├─ Manual penetration test checklist:                                            │
│ │   ├── Can you access another project's data by changing IDs?                 │
│ │   ├── Can you escalate your own role via API?                                │
│ │   ├── Can you bypass rate limiting?                                          │
│ │   └── Can you inject malicious content that executes in the UI?             │
│ │                                                                               │
│ └─ Acceptance: No critical or high security findings                            │
│                                                                                   │
│ Task 9.6: Monitoring & Alerting Setup                                            │
│ ├─ Sentry integration:                                                          │
│ │   ├── Error tracking with source maps                                        │
│ │   ├── Performance monitoring (transaction tracing)                           │
│ │   └── Alert on error spike (>1% of requests)                                │
│ │                                                                               │
│ ├─ Custom metrics (Prometheus):                                                  │
│ │   ├── reviews_processed_total (counter, by source, sentiment)                │
│ │   ├── ai_pipeline_duration_seconds (histogram)                               │
│ │   ├── ai_pipeline_cost_cents (counter)                                       │
│ │   ├── sse_active_connections (gauge)                                         │
│ │   ├── api_request_duration_seconds (histogram, by endpoint)                  │
│ │   └── queue_depth (gauge, by queue name)                                     │
│ │                                                                               │
│ ├─ Health check endpoint:                                                        │
│ │   GET /api/health                                                             │
│ │   ├── Check: PostgreSQL connectivity                                         │
│ │   ├── Check: Redis connectivity                                              │
│ │   ├── Check: ChromaDB connectivity                                           │
│ │   ├── Check: Claude API reachability                                         │
│ │   └── Returns: { status: "healthy"|"degraded"|"unhealthy", checks: {} }     │
│ │                                                                               │
│ ├─ Structured logging (pino):                                                    │
│ │   ├── Request ID propagation for distributed tracing                         │
│ │   ├── Log levels configurable per environment                                │
│ │   └── No sensitive data in logs (passwords, tokens, API keys)                │
│ │                                                                               │
│ └─ Acceptance: Errors surface within 5 minutes, metrics are visible in Grafana  │
│                                                                                   │
│ Day 4: Production Deployment                                                     │
│ ──────────────────────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Task 9.7: Production Infrastructure                                              │
│ ├─ Provision production environment:                                            │
│ │   ├── PostgreSQL (Supabase / Neon)                                           │
│ │   ├── Redis (Upstash)                                                        │
│ │   ├── ChromaDB (Railway / Fly.io with persistent volume)                     │
│ │   ├── Object storage (Cloudflare R2 / AWS S3)                                │
│ │   └── TLS certificates (auto-provisioned)                                    │
│ │                                                                               │
│ ├─ Environment variables:                                                        │
│ │   ├── All secrets set (not in code, not in Git)                              │
│ │   ├── Production database, Redis, and ChromaDB URLs                          │
│ │   ├── Anthropic + Voyage AI API keys (production quotas)                     │
│ │   ├── JWT secret (unique, 64+ random chars)                                  │
│ │   └── CORS origins (production domain only)                                  │
│ │                                                                               │
│ ├─ Database setup:                                                               │
│ │   ├── Run all migrations                                                     │
│ │   ├── Create indexes                                                         │
│ │   ├── Enable extensions (pg_trgm, uuid-ossp)                                 │
│ │   ├── Configure connection pooling                                           │
│ │   └── Set up automated backups (daily, 30-day retention)                    │
│ │                                                                               │
│ └─ Acceptance: Production environment is live and healthy                        │
│                                                                                   │
│ Task 9.8: Deployment Pipeline                                                    │
│ ├─ Staging deployment and sign-off:                                              │
│ │   ├── Deploy to staging, run smoke tests                                     │
│ │   └── Verify all features with production-like data                          │
│ │                                                                               │
│ ├─ Production deployment:                                                        │
│ │   ├── Manual approval gate in CI/CD                                          │
│ │   ├── Run database migrations (backward-compatible only)                     │
│ │   ├── Deploy application containers (Vercel + Railway)                       │
│ │   ├── Health check verification (auto-rollback on failure)                   │
│ │   └── Monitor error rates for 30 minutes                                    │
│ │                                                                               │
│ ├─ Rollback plan:                                                               │
│ │   ├── Keep previous container image tagged                                   │
│ │   ├── Database migrations must be backward-compatible                        │
│ │   ├── One-command rollback: redeploy previous image                          │
│ │   └── Rollback decision criteria: error rate >2%, health check fails        │
│ │                                                                               │
│ └─ Acceptance: App is live in production, monitored, and rollback-ready         │
│                                                                                   │
│ Task 9.9: Demo Data & Documentation                                              │
│ ├─ Production demo project:                                                     │
│ │   ├── 500+ realistic pre-analyzed sample reviews                            │
│ │   ├── Pre-generated insights                                                 │
│ │   └── Demo user accounts                                                     │
│ │                                                                               │
│ ├─ User documentation:                                                          │
│ │   ├── Getting started guide                                                  │
│ │   ├── How to connect sources / upload reviews                                │
│ │   ├── Understanding the dashboard                                            │
│ │   ├── Using the AI assistant                                                 │
│ │   └── API documentation (auto-generated from OpenAPI spec)                  │
│ │                                                                               │
│ └─ Acceptance: New user can go from signup to first insight in <10 minutes      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Master Timeline

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              GANTT-STYLE TIMELINE                                        │
│                                                                                          │
│  Week 1            Week 2            Week 3            Week 4            Week 5          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌───────────┐ │
│  │ Phase 1     │   │ Phase 3     │   │ Phase 5     │   │ Phase 7     │   │ Phase 9   │ │
│  │ Foundation  │   │ Auth & API  │   │ Ingestion   │   │ Analytics   │   │ Test &    │ │
│  │ (3 days)    │   │ (3 days)    │   │ (3 days)    │   │ (3 days)    │   │ Deploy    │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   │ (4 days)  │ │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   └───────────┘ │
│  │ Phase 2     │   │ Phase 4     │   │ Phase 6     │   │ Phase 8     │                 │
│  │ Database    │   │ AI Prompts  │   │ AI Pipeline │   │ Frontend    │                 │
│  │ (2 days)    │   │ (parallel)  │   │ (4 days)    │   │ (5 days)    │                 │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘                 │
│                                                                                          │
│  ◄── Foundation ──►◄─── Core Features ───►◄──── AI & UX ────►◄─── Ship ──►             │
│                                                                                          │
│  Total: 5 working weeks (25 working days) for a single full-stack developer             │
│  With 2 developers:                   3–3.5 weeks                                       │
│  With 3 developers (FE + BE + AI):    2.5–3 weeks                                       │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PHASE SUMMARY TABLE                                      │
│                                                                                          │
│  Phase │ Name                      │ Duration │ Depends On  │ Key Deliverable            │
│  ──────┼───────────────────────────┼──────────┼─────────────┼──────────────────────────  │
│  1     │ Foundation & Setup        │ 3 days   │ —           │ Dev environment ready      │
│  2     │ Database Schema           │ 2 days   │ 1           │ 12 tables, migrations      │
│  3     │ Auth & API Scaffold       │ 3 days   │ 2           │ Full auth + RBAC           │
│  4     │ AI Prompt Engineering     │ 3 days   │ 1 (parallel)│ Tested prompt library      │
│  5     │ Review Ingestion          │ 3 days   │ 2, 3        │ Upload + connectors        │
│  6     │ AI Pipeline               │ 4 days   │ 3, 4        │ Full AI processing + RAG   │
│  7     │ Analytics Engine          │ 3 days   │ 5, 6        │ Dashboard APIs + exports   │
│  8     │ Frontend Dashboard        │ 5 days   │ 5, 6, 7     │ Complete UI                │
│  9     │ Testing & Deployment      │ 4 days   │ All         │ Production live            │
│  ──────┼───────────────────────────┼──────────┼─────────────┼──────────────────────────  │
│  Total │                           │ 25 days  │             │ Full product               │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. MVP Feature Matrix

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         MVP FEATURE MATRIX                                       │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  MVP (Must Have) — Ship this or don't ship at all                       │    │
│  │                                                                         │    │
│  │  ✓ User registration, login, and project setup                         │    │
│  │  ✓ CSV review upload with validation                                   │    │
│  │  ✓ AI sentiment analysis per review (via Claude batch processing)      │    │
│  │  ✓ AI theme extraction and priority scoring                            │    │
│  │  ✓ Embedding generation + semantic vector search (Voyage AI + ChromaDB)│    │
│  │  ✓ AI-generated insights and summaries                                 │    │
│  │  ✓ Overview dashboard (sentiment, themes, ratings, priority)           │    │
│  │  ✓ Review list with filters (sentiment, source, priority, theme)       │    │
│  │  ✓ AI chat assistant (RAG-based Q&A with source citations)             │    │
│  │  ✓ Real-time processing progress via SSE                               │    │
│  │  ✓ Cloud deployment                                                    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  V1.1 (Week 6–7) — Important but not launch-blocking                   │    │
│  │                                                                         │    │
│  │  ○ App Store + Google Play live connectors                              │    │
│  │  ○ Background sync engine (scheduled pulls)                             │    │
│  │  ○ Team management (invite, roles)                                     │    │
│  │  ○ Weekly digest insights (AI-generated)                               │    │
│  │  ○ CSV / PDF export                                                    │    │
│  │  ○ Review flagging and internal notes                                  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  V1.2 (Week 8–10) — Growth features                                    │    │
│  │                                                                         │    │
│  │  ○ G2, Trustpilot, Reddit source connectors                            │    │
│  │  ○ Slack integration for insights notifications                        │    │
│  │  ○ Custom webhook delivery                                             │    │
│  │  ○ Dark mode                                                           │    │
│  │  ○ On-demand analytics queries (natural language)                      │    │
│  │  ○ Trend detection and automated alerts                                │    │
│  │  ○ Performance optimizations (caching, query tuning)                   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  V2.0 (Month 3+) — Scale & Enterprise                                  │    │
│  │                                                                         │    │
│  │  ○ SSO (SAML / OIDC)                                                   │    │
│  │  ○ Custom AI model fine-tuning (for cost reduction at scale)           │    │
│  │  ○ Multi-language support (full, 10+ languages)                        │    │
│  │  ○ Zendesk / Intercom integrations                                     │    │
│  │  ○ Public REST API with documentation                                  │    │
│  │  ○ Advanced analytics (cohort analysis, predictive trends)             │    │
│  │  ○ ChromaDB → Pinecone / Weaviate migration for vector search at scale │    │
│  │  ○ AI pipeline extraction into standalone microservice                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Risk Register

| #   | Risk                                             | Likelihood | Impact   | Mitigation                                                                                                                                     |
| --- | ------------------------------------------------ | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **LLM API cost exceeds budget at scale**         | Medium     | High     | Batch processing (15 reviews/call). Cache identical review text. Cost alerts at 80% of budget. Evaluate claude-haiku for batch classification. |
| 2   | **AI analysis accuracy is insufficient**         | Medium     | High     | Test prompts on 100+ labeled reviews in Phase 4 before pipeline. Allow manual correction. A/B test between models.                             |
| 3   | **Platform API changes break connectors**        | High       | Medium   | Abstract connector interface. Monitor API changelogs. Graceful degradation (fall back to CSV upload).                                          |
| 4   | **ChromaDB performance at scale**                | Low        | High     | Benchmark at 100K+ vectors early. Migration path to Pinecone documented in architecture.                                                       |
| 5   | **AI hallucination in RAG chat**                 | Medium     | High     | Always cite source reviews. Model instructed to say "I don't know" when data is insufficient.                                                  |
| 6   | **Timeline slips due to AI pipeline complexity** | High       | Medium   | Phase 4 runs in parallel. Prompts designed and tested before pipeline code is written.                                                         |
| 7   | **Project data isolation failure**               | Low        | Critical | Per-project authorization middleware on every endpoint. Integration tests for isolation. Security audit in Phase 9.                            |
| 8   | **Embedding model API unavailability**           | Medium     | Medium   | Fallback chain: Voyage AI → OpenAI `text-embedding-3-small`. Embeddings queue retries on recovery.                                             |

---

## 7. Definition of Done (Global)

Every task across every phase must satisfy these criteria before it's marked complete:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       DEFINITION OF DONE                                         │
│                                                                                   │
│  □ Code compiles with zero TypeScript errors                                     │
│  □ All existing tests still pass (no regressions)                                │
│  □ New functionality has test coverage (unit + integration where applicable)     │
│  □ API endpoints have request/response validation (Zod schemas)                  │
│  □ Error cases handled (no unhandled exceptions, no silent failures)             │
│  □ Project-level data isolation enforced (project_id scoped on all data access)  │
│  □ Logging added for key operations (with request_id for traceability)           │
│  □ No secrets, API keys, or passwords in code or logs                            │
│  □ Code reviewed (if team) or self-reviewed against checklist                    │
│  □ Works in Docker (not just "works on my machine")                              │
│  □ Documented: any non-obvious behavior, API contracts, config requirements      │
└──────────────────────────────────────────────────────────────────────────────────┘
```
