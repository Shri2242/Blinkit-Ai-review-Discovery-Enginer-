# AI-Powered Review Discovery Engine — System Architecture

> **Document status:** Living document. Updated as design decisions are made and implementation progresses.
>
> **Last updated:** June 2026
> **Related documents:** [Problem Statement](./problemstatement.md) · [Implementation Plan](./implementationplan.md)

---

## Table of Contents

1. [Architecture Philosophy](#1-architecture-philosophy)
2. [Technology Stack](#2-technology-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Component Deep Dive](#4-component-deep-dive)
   - 4.1 [Review Ingestion Service](#41-review-ingestion-service)
   - 4.2 [Processing Pipeline](#42-processing-pipeline)
   - 4.3 [AI Architecture](#43-ai-architecture)
   - 4.4 [Storage Layer](#44-storage-layer)
   - 4.5 [Complete Database Schema](#45-complete-database-schema)
   - 4.6 [API Design](#46-api-design)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
   - 5.1 [Review Upload Flow](#51-review-upload-flow)
   - 5.2 [RAG Chat Flow](#52-rag-chat-flow)
   - 5.3 [Complete Review Lifecycle](#53-complete-review-lifecycle)
6. [Security Architecture](#6-security-architecture)
7. [Scalability Considerations](#7-scalability-considerations)
8. [Monitoring & Observability](#8-monitoring--observability)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Architecture Decision Records (ADRs)](#10-architecture-decision-records-adrs)
11. [Intentional Exclusions (MVP Scope)](#11-intentional-exclusions-mvp-scope)

---

## 1. Architecture Philosophy

Before diving into components, here are the principles driving every design decision in this system:

| Principle                    | What It Means in Practice                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modular Monolith First**   | Single deployable unit with clear internal boundaries. Can be split into microservices later when scale demands it. Not prematurely decomposed.                           |
| **Async-First Processing**   | All AI operations are non-blocking. Reviews are ingested instantly, analyzed in the background. The API never waits on an LLM call.                                       |
| **Separation of Concern**    | Ingestion, analysis, storage, retrieval, and presentation are independent layers with defined interfaces. Any layer can be replaced without affecting others.             |
| **Observability by Default** | Every pipeline stage is instrumented. If we can't measure it, we can't improve it.                                                                                        |
| **Cost-Conscious AI**        | AI calls are the most expensive operation. Every design choice minimizes unnecessary LLM invocations — caching, batching, and deterministic pre-filtering where possible. |

---

## 2. Technology Stack

| Layer                | Technology                                                                          | Rationale                                                                      |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Frontend**         | Next.js 14 (App Router) + TypeScript                                                | Server components, co-located API routes, one deployment unit                  |
| **UI Components**    | shadcn/ui + Tailwind CSS                                                            | Rapid, consistent, accessible component library                                |
| **API**              | Next.js API Routes (REST)                                                           | Co-located with frontend, no separate server needed at MVP                     |
| **Job Queue**        | BullMQ + Redis                                                                      | Mature, Redis-backed, supports priorities, retries, and monitoring UI          |
| **Primary Database** | PostgreSQL                                                                          | Relational model, JSONB, excellent aggregation, battle-tested                  |
| **Vector Database**  | ChromaDB                                                                            | Simple, self-hostable, Docker-friendly, no managed service cost at MVP         |
| **Cache / Sessions** | Redis                                                                               | Same Redis instance as queue; sessions, rate limiting, pub/sub                 |
| **Primary AI Model** | Claude (claude-sonnet-4-5)                                                          | Strong JSON compliance, large context for batching, competitive cost           |
| **Embedding Model**  | Voyage AI (`voyage-3`)                                                              | Best retrieval quality per dollar; OpenAI `text-embedding-3-small` as fallback |
| **Real-time Events** | Server-Sent Events (SSE)                                                            | Simpler than WebSockets for one-way server→client updates                      |
| **File Storage**     | S3-compatible (Cloudflare R2 / AWS S3)                                              | CSV uploads, exports, raw review snapshots                                     |
| **Deployment**       | Vercel (frontend/API) + Railway (workers) + Supabase (PostgreSQL) + Upstash (Redis) | Managed services minimize operational overhead at MVP                          |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │  Dashboard    │  │  API Clients │  │  Webhook     │                      │
│  │  (Next.js)    │  │  (External)  │  │  Consumers   │                      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                      │
└─────────┼─────────────────┼─────────────────┼───────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Next.js API Routes (App Router)                    │   │
│  │                                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │  Auth     │  │  Rate    │  │  Request │  │  Error   │             │   │
│  │  │  Middleware│  │  Limiter │  │  Logger  │  │  Handler │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└────────────┬────────────────────┬────────────────────┬──────────────────────┘
             │                    │                    │
     ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
     │               │   │               │   │               │
     ▼               ▼   ▼               ▼   ▼               ▼
┌─────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Ingestion│  │  Query /     │  │  Analytics   │  │  Real-time       │
│ Service  │  │  Search Svc  │  │  Service     │  │  Events (SSE)    │
└────┬─────┘  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
     │               │                 │                    │
     ▼               ▼                 ▼                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROCESSING PIPELINE                                  │
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Review   │    │  AI      │    │  Embedding│    │  Insight │              │
│  │  Normalizer│──▶│  Analyzer │──▶│  Generator│──▶│  Aggregator│            │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│        │               │               │               │                    │
│        ▼               ▼               ▼               ▼                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Job Queue (BullMQ / Redis)                         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ parse-queue │  │ analyze-q  │  │ embed-queue│  │ insight-q  │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
             │                    │                    │
             ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYER                                      │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  PostgreSQL   │  │  ChromaDB    │  │  Redis       │  │  S3 / Blob   │   │
│  │  (Primary DB) │  │  (Vectors)   │  │  (Cache/Queue)│  │  (File Store)│   │
│  │               │  │              │  │              │  │              │   │
│  │  - Reviews    │  │  - Embeddings│  │  - Sessions  │  │  - CSV Files │   │
│  │  - Users      │  │  - Semantic  │  │  - Job Queue │  │  - Exports   │   │
│  │  - Insights   │  │    Index     │  │  - Rate Limit│  │  - Raw Data  │   │
│  │  - Analytics  │  │              │  │  - Cache     │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI / LLM LAYER                                     │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      AI Orchestrator                                  │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  Sentiment    │  │  Theme       │  │  Priority    │               │   │
│  │  │  Classifier   │  │  Extractor   │  │  Scorer      │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  Summarizer   │  │  RAG Engine  │  │  Trend       │               │   │
│  │  │              │  │  (Chat/Q&A)  │  │  Detector    │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │                                                                       │   │
│  │  Primary: Claude API (claude-sonnet-4-5)                             │   │
│  │  Embeddings: Voyage AI voyage-3 (fallback: OpenAI text-embedding-3)  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Deep Dive

### 4.1 Review Ingestion Service

**Purpose:** Accept reviews from any source, normalize them into a canonical format, validate, deduplicate, and enqueue for processing.

**Why it exists as a separate layer:**
Reviews arrive in wildly different formats. An App Store review has a rating, title, body, and date. A CSV upload has whatever columns the user defined. A support ticket has a description, priority, and status. The ingestion layer absorbs all this variance and outputs one clean, predictable internal format regardless of source.

```
┌─────────────────────────────────────────────────────────┐
│                  INGESTION PIPELINE                      │
│                                                          │
│  Source Adapters                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │  CSV    │ │  App    │ │  Google │ │  Manual │       │
│  │  Parser │ │  Store  │ │  Play   │ │  Entry  │       │
│  │         │ │  API    │ │  API    │ │  Form   │       │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │
│       │           │           │           │              │
│       ▼           ▼           ▼           ▼              │
│  ┌──────────────────────────────────────────────┐       │
│  │            Canonical Normalizer               │       │
│  │                                               │       │
│  │  Input    →  Map to internal schema           │       │
│  │  Strip    →  HTML, special chars, PII         │       │
│  │  Validate →  Required fields present          │       │
│  │  Dedupe   →  Hash(review_text + source + date)│       │
│  └──────────────────┬───────────────────────────┘       │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────┐       │
│  │            Canonical Review Object            │       │
│  │                                               │       │
│  │  {                                            │       │
│  │    id: uuid,                                  │       │
│  │    source: enum,                              │       │
│  │    source_review_id: string,                  │       │
│  │    review_text: string,                       │       │
│  │    rating: number | null,                     │       │
│  │    title: string | null,                      │       │
│  │    author: string | null,                     │       │
│  │    date: ISO-8601,                            │       │
│  │    language: string,                          │       │
│  │    metadata: jsonb,                           │       │
│  │    content_hash: string,                      │       │
│  │    processing_status: "pending",              │       │
│  │    created_at: timestamp                      │       │
│  │  }                                            │       │
│  └──────────────────┬───────────────────────────┘       │
│                     │                                    │
│                     ▼                                    │
│            ┌─────────────────┐                          │
│            │  Enqueue Job    │                          │
│            │  (BullMQ)       │                          │
│            └─────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

| Decision                        | Rationale                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Deduplication via content hash  | Users may re-upload the same CSV or the same review may appear on multiple platforms. Hash prevents duplicate processing and inflated metrics. |
| Language detection at ingestion | AI prompts and models may need to be language-aware. Detecting early allows the pipeline to route appropriately.                               |
| `processing_status` field       | Enables tracking: `pending` → `processing` → `completed` / `failed`. Failed reviews can be retried without re-ingestion.                       |
| Metadata as JSONB               | Different sources carry different extra fields. JSONB is flexible without requiring schema migrations for every new source.                    |

---

### 4.2 Processing Pipeline

**Purpose:** Asynchronous, queue-driven pipeline that takes raw reviews through normalization → AI analysis → embedding generation → insight aggregation.

**Why async:**
AI analysis takes 2–10 seconds per review. If a user uploads 5,000 reviews, a synchronous approach would timeout the HTTP request long before completion. With a queue, ingestion returns a `202 Accepted` instantly, and processing happens in the background with live progress tracking via SSE.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROCESSING PIPELINE (DETAIL)                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     JOB QUEUES (Redis + BullMQ)                  │   │
│  │                                                                  │   │
│  │   ┌──────────┐                                                  │   │
│  │   │ Stage 1  │  parse-queue                                      │   │
│  │   │          │  • Validate review structure                      │   │
│  │   │          │  • Extract metadata                               │   │
│  │   │          │  • Detect language                                │   │
│  │   │          │  • Mark as ready for AI                           │   │
│  │   └────┬─────┘                                                  │   │
│  │        │  on success                                             │   │
│  │        ▼                                                         │   │
│  │   ┌──────────┐                                                  │   │
│  │   │ Stage 2  │  analyze-queue                                    │   │
│  │   │          │  • Send to Claude API                             │   │
│  │   │          │  • Extract: sentiment, theme, priority, summary   │   │
│  │   │          │  • Store structured analysis                      │   │
│  │   │          │  • BULK PROCESSING: batches of 10–20 reviews      │   │
│  │   └────┬─────┘                                                  │   │
│  │        │  on success                                             │   │
│  │        ▼                                                         │   │
│  │   ┌──────────┐                                                  │   │
│  │   │ Stage 3  │  embed-queue                                      │   │
│  │   │          │  • Generate embeddings (Voyage AI / fallback)     │   │
│  │   │          │  • Store in ChromaDB                              │   │
│  │   │          │  • Index for semantic search                      │   │
│  │   └────┬─────┘                                                  │   │
│  │        │  on success                                             │   │
│  │        ▼                                                         │   │
│  │   ┌──────────┐                                                  │   │
│  │   │ Stage 4  │  insight-queue                                    │   │
│  │   │          │  • Trigger insight aggregation                    │   │
│  │   │          │  • Update trend counters                          │   │
│  │   │          │  • Recalculate theme distributions                │   │
│  │   │          │  • Emit SSE event to connected clients            │   │
│  │   └──────────┘                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     WORKER CONFIGURATION                         │   │
│  │                                                                  │   │
│  │  parse-queue:     concurrency = 10  (CPU-bound, fast)            │   │
│  │  analyze-queue:   concurrency = 5   (API-bound, rate-limited)    │   │
│  │  embed-queue:     concurrency = 5   (API-bound)                  │   │
│  │  insight-queue:   concurrency = 2   (heavy aggregation)          │   │
│  │                                                                  │   │
│  │  Retry policy: exponential backoff, max 3 retries                │   │
│  │  Dead letter queue: permanently failed jobs for manual review     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Batching Strategy for AI Calls:**

Instead of sending 1 review per API call, we batch 10–20 reviews into a single Claude prompt. This is the single biggest performance and cost lever in the system.

```
Analyze each of the following customer reviews. For each, extract:
- sentiment: positive | negative | neutral | mixed
- theme: primary category
- sub_theme: specific topic within the theme
- priority: critical | high | medium | low
- summary: one sentence summary of the feedback

Return a JSON array with one object per review, in the same order.

Reviews:
1. {review_text_1}
2. {review_text_2}
...
```

**Why batching matters — the numbers:**

| Approach                                   | Time for 5,000 reviews |
| ------------------------------------------ | ---------------------- |
| 1 review per API call, sequential          | ~4.2 hours             |
| 15 reviews per batch, sequential           | ~28 minutes            |
| 15 reviews per batch, 5 concurrent workers | ~5.5 minutes           |

**That's a 45× improvement** over naive per-review processing.

---

### 4.3 AI Architecture

**Purpose:** The intelligence layer. Takes raw review text and produces structured analysis + semantic vector representations.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI ARCHITECTURE                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    AI ORCHESTRATOR                                │   │
│  │                                                                  │   │
│  │  Coordinates all AI operations. Manages:                         │   │
│  │  • Prompt assembly                                               │   │
│  │  • Response parsing + validation                                 │   │
│  │  • Error handling + fallback logic                               │   │
│  │  • Token budget tracking                                         │   │
│  │  • Model selection (primary vs. fallback)                        │   │
│  └──────────┬──────────────────────────────────────────────────────┘   │
│             │                                                          │
│     ┌───────┼───────┬──────────────┬──────────────┬──────────────┐     │
│     ▼       ▼       ▼              ▼              ▼              ▼     │
│  ┌───────┐┌───────┐┌───────────┐┌───────────┐┌───────────┐┌─────────┐│
│  │Sentim-││Theme  ││ Priority  ││ Summar-   ││ RAG       ││ Trend   ││
│  │ent    ││Ext-   ││ Scorer    ││ izer      ││ Engine    ││ Detector││
│  │Class- ││ractor ││           ││           ││           ││         ││
│  │ifier  ││       ││           ││           ││           ││         ││
│  └───────┘└───────┘└───────────┘└───────────┘└───────────┘└─────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.3.1 Prompt Engineering Strategy

**System Prompt (shared across all analysis tasks):**

```
You are a customer feedback analysis engine for a product team.
You analyze customer reviews with high precision and consistency.

Rules:
- Always return valid JSON matching the requested schema.
- Be specific with theme classification. Do not use "other" unless truly unclassifiable.
- Sentiment must reflect the overall tone, not just individual sentences.
- Priority must consider both explicit severity and implied business impact.
- Never fabricate information not present in the review.
- If a review is ambiguous, classify sentiment as "mixed" rather than guessing.
```

**Analysis Prompt (per-batch):**

```json
// Analyze each customer review below. Return a JSON array.

// For each review, provide:
{
  "review_index": <number>,
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentiment_confidence": <0.0 to 1.0>,
  "theme": "<primary category>",
  "sub_theme": "<specific topic>",
  "priority": "critical" | "high" | "medium" | "low",
  "priority_reason": "<why this priority>",
  "key_phrases": ["<phrase1>", "<phrase2>"],
  "summary": "<one sentence summary>",
  "actionable": true | false,
  "is_bug": true | false,
  "is_feature_request": true | false
}

// Theme taxonomy (exhaustive — use only these):
// "payment"     — checkout, billing, transactions, refunds
// "performance" — speed, crashes, loading, freezing
// "usability"   — navigation, UI confusion, accessibility
// "onboarding"  — signup, setup, first-time experience
// "features"    — feature requests, missing functionality
// "support"     — customer service experience
// "pricing"     — cost complaints, plan confusion, value perception
// "security"    — privacy concerns, data handling, account security
// "reliability" — bugs, data loss, unexpected behavior
// "content"     — content quality, relevance, moderation
```

**Summarization Prompt (weekly/theme-level):**

```json
// Produce a structured theme summary:
{
  "theme": "{theme}",
  "period": "{date_range}",
  "total_reviews": {count},
  "sentiment_distribution": {
    "positive": {n},
    "negative": {n},
    "neutral": {n},
    "mixed": {n}
  },
  "executive_summary": "<2–3 sentence overview for a product leader>",
  "top_issues": [
    {
      "issue": "<specific problem>",
      "frequency": "<how often mentioned>",
      "example_quotes": ["<quote1>", "<quote2>"],
      "recommended_action": "<what to do about it>"
    }
  ],
  "trend": "improving" | "worsening" | "stable",
  "trend_evidence": "<reasoning>"
}
```

#### 4.3.2 RAG Architecture

The RAG (Retrieval-Augmented Generation) engine powers the AI chat interface, allowing teams to ask natural language questions and get grounded, cited answers from the actual review corpus.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      RAG ENGINE — DETAILED FLOW                         │
│                                                                         │
│  User asks: "Why are users complaining about checkout?"                 │
│                         │                                               │
│                         ▼                                               │
│  ┌──────────────────────────────────────┐                              │
│  │  Step 1: Query Embedding              │                              │
│  │  Convert user question to vector      │                              │
│  │  using same embedding model as        │                              │
│  │  stored review embeddings             │                              │
│  └──────────────────┬───────────────────┘                              │
│                     │                                                   │
│                     ▼                                                   │
│  ┌──────────────────────────────────────┐                              │
│  │  Step 2: Semantic Search              │                              │
│  │  Query ChromaDB for top-K             │                              │
│  │  most similar review embeddings       │                              │
│  │                                       │                              │
│  │  Filters applied:                     │                              │
│  │  • theme = "payment" (if detected)    │                              │
│  │  • sentiment = "negative"             │                              │
│  │  • date_range = last 90 days          │                              │
│  │                                       │                              │
│  │  K = 20 most similar reviews          │                              │
│  └──────────────────┬───────────────────┘                              │
│                     │                                                   │
│                     ▼                                                   │
│  ┌──────────────────────────────────────┐                              │
│  │  Step 3: Context Assembly             │                              │
│  │  Build context window from:           │                              │
│  │  • Retrieved review texts             │                              │
│  │  • Their AI-generated summaries       │                              │
│  │  • Their sentiment + priority scores  │                              │
│  │  • Aggregate statistics               │                              │
│  │                                       │                              │
│  │  Truncate to fit model context        │                              │
│  │  window (~8K tokens reserved)         │                              │
│  └──────────────────┬───────────────────┘                              │
│                     │                                                   │
│                     ▼                                                   │
│  ┌──────────────────────────────────────┐                              │
│  │  Step 4: Generation                   │                              │
│  │                                       │                              │
│  │  System: "You are a product analyst.  │                              │
│  │  Answer based ONLY on the provided    │                              │
│  │  review context. Cite specific        │                              │
│  │  reviews when possible. If the        │                              │
│  │  context doesn't contain enough       │                              │
│  │  information, say so."                │                              │
│  │                                       │                              │
│  │  User: "{original_question}"          │                              │
│  │  Context: "{assembled_reviews}"       │                              │
│  │                                       │                              │
│  │  Output: natural language answer      │                              │
│  │  with citations to source reviews     │                              │
│  └──────────────────┬───────────────────┘                              │
│                     │                                                   │
│                     ▼                                                   │
│  ┌──────────────────────────────────────┐                              │
│  │  Step 5: Response                     │                              │
│  │                                       │                              │
│  │  {                                    │                              │
│  │    "answer": "Users report that...",  │                              │
│  │    "source_reviews": [                │                              │
│  │      {"id": "...", "text": "..."}     │                              │
│  │    ],                                 │                              │
│  │    "confidence": 0.87,                │                              │
│  │    "related_themes": ["payment",      │                              │
│  │      "performance"]                   │                              │
│  │  }                                    │                              │
│  └──────────────────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Embedding Strategy:**

| Aspect                 | Decision                                                                     |
| ---------------------- | ---------------------------------------------------------------------------- |
| **Primary model**      | Voyage AI `voyage-3` — best price/performance for retrieval tasks            |
| **Fallback model**     | OpenAI `text-embedding-3-small` — widely supported, lower cost               |
| **Dimension**          | 1024 (voyage-3) or 1536 (OpenAI)                                             |
| **Chunking**           | Each review = 1 chunk (reviews are short enough to not need splitting)       |
| **Metadata filtering** | Pre-filter by theme, sentiment, date, source before vector similarity search |
| **Re-indexing**        | Incremental — only new reviews get embedded, not full re-index               |

---

### 4.4 Storage Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STORAGE ARCHITECTURE                            │
│                                                                         │
│  ┌─────────────────────────────────────────┐  ┌──────────────────────┐ │
│  │           PostgreSQL (Primary)           │  │   ChromaDB (Vectors) │ │
│  │                                          │  │                      │ │
│  │   Source of truth for structured data.   │  │   Source of truth    │ │
│  │   Handles:                               │  │   for embeddings.    │ │
│  │   • All CRUD operations                  │  │   Handles:           │ │
│  │   • Complex queries (aggregations,       │  │   • Vector similarity│ │
│  │     joins, filtering)                    │  │     search           │ │
│  │   • Transactional consistency            │  │   • Metadata-filtered│ │
│  │   • Full-text search (fallback)          │  │     queries          │ │
│  │                                          │  │   • Approximate      │ │
│  │   Why PostgreSQL over alternatives:      │  │     nearest neighbor │ │
│  │   • JSONB for flexible metadata          │  │                      │ │
│  │   • pg_trgm for fuzzy text matching      │  │   Why ChromaDB:      │ │
│  │   • Excellent aggregation functions      │  │   • Simple API       │ │
│  │   • Battle-tested at scale               │  │   • Docker-friendly  │ │
│  │   • Rich ecosystem                       │  │   • No infra overhead│ │
│  │                                          │  │   • Right for MVP    │ │
│  └─────────────────────────────────────────┘  └──────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────┐  ┌──────────────────────┐ │
│  │           Redis (Cache + Queue)          │  │   Object Storage     │ │
│  │                                          │  │   (S3 / R2 / Disk)   │ │
│  │   • Session storage                      │  │                      │ │
│  │   • Job queue backend (BullMQ)           │  │   • Uploaded CSV     │ │
│  │   • API response cache                   │  │     files            │ │
│  │   • Rate limiting counters               │  │   • Export files     │ │
│  │   • Real-time pub/sub for SSE            │  │   • Raw review       │ │
│  │   • Processing progress tracking         │  │     snapshots        │ │
│  └─────────────────────────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 4.5 Complete Database Schema

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE review_source AS ENUM (
    'csv_upload', 'app_store', 'google_play', 'trustpilot',
    'g2', 'steam', 'reddit', 'twitter', 'zendesk', 'intercom',
    'manual_entry'
);

CREATE TYPE processing_status AS ENUM (
    'pending', 'processing', 'completed', 'failed', 'retrying'
);

CREATE TYPE sentiment_type AS ENUM (
    'positive', 'negative', 'neutral', 'mixed'
);

CREATE TYPE priority_level AS ENUM (
    'critical', 'high', 'medium', 'low'
);

CREATE TYPE theme_category AS ENUM (
    'payment', 'performance', 'usability', 'onboarding',
    'features', 'support', 'pricing', 'security',
    'reliability', 'content', 'other'
);

CREATE TYPE user_role AS ENUM (
    'admin', 'analyst', 'viewer'
);

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- PROJECTS
-- Each project represents one product/app being tracked.
-- Supports multi-tenant usage.
-- ============================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    app_store_url   TEXT,
    google_play_url TEXT,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);

CREATE TABLE project_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        user_role NOT NULL DEFAULT 'viewer',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ============================================================
-- REVIEWS (core entity)
-- AI analysis columns are denormalized onto this table
-- for query performance — avoids joins on the hot path.
-- ============================================================

CREATE TABLE reviews (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source               review_source NOT NULL,
    source_review_id     VARCHAR(255),
    review_text          TEXT NOT NULL,
    review_title         TEXT,
    rating               SMALLINT CHECK (rating BETWEEN 1 AND 5),
    author_name          VARCHAR(255),
    author_url           TEXT,
    review_date          TIMESTAMPTZ NOT NULL,
    language             VARCHAR(10) DEFAULT 'en',
    content_hash         VARCHAR(64) NOT NULL,
    metadata             JSONB DEFAULT '{}',

    -- Processing state
    processing_status    processing_status NOT NULL DEFAULT 'pending',
    processed_at         TIMESTAMPTZ,
    processing_error     TEXT,
    retry_count          SMALLINT DEFAULT 0,

    -- AI Analysis results (denormalized for query performance)
    sentiment            sentiment_type,
    sentiment_confidence FLOAT,
    theme                theme_category,
    sub_theme            VARCHAR(255),
    priority             priority_level,
    priority_reason      TEXT,
    key_phrases          TEXT[],
    ai_summary           TEXT,
    is_bug               BOOLEAN DEFAULT false,
    is_feature_request   BOOLEAN DEFAULT false,
    actionable           BOOLEAN DEFAULT false,

    -- Embedding reference (ChromaDB document ID)
    embedding_id         VARCHAR(255),

    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, source, source_review_id)
);

-- Indexes covering the most common query patterns
CREATE INDEX idx_reviews_project           ON reviews(project_id);
CREATE INDEX idx_reviews_project_sentiment ON reviews(project_id, sentiment);
CREATE INDEX idx_reviews_project_theme     ON reviews(project_id, theme);
CREATE INDEX idx_reviews_project_priority  ON reviews(project_id, priority);
CREATE INDEX idx_reviews_project_date      ON reviews(project_id, review_date DESC);
CREATE INDEX idx_reviews_project_status    ON reviews(project_id, processing_status);
CREATE INDEX idx_reviews_content_hash      ON reviews(content_hash);
CREATE INDEX idx_reviews_rating            ON reviews(project_id, rating);

-- Full-text search fallback (when vector search isn't needed)
CREATE INDEX idx_reviews_text_search ON reviews
    USING gin(to_tsvector('english', review_text));

-- Composite index for dashboard summary queries
CREATE INDEX idx_reviews_dashboard ON reviews(
    project_id, sentiment, theme, priority, review_date DESC
);

-- ============================================================
-- UPLOAD BATCHES
-- Tracks CSV uploads and bulk imports with per-row progress.
-- ============================================================

CREATE TABLE upload_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    filename        VARCHAR(255) NOT NULL,
    source          review_source NOT NULL DEFAULT 'csv_upload',
    file_url        TEXT,
    total_rows      INTEGER DEFAULT 0,
    processed_rows  INTEGER DEFAULT 0,
    failed_rows     INTEGER DEFAULT 0,
    status          processing_status NOT NULL DEFAULT 'pending',
    error_log       JSONB DEFAULT '[]',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uploads_project ON upload_batches(project_id);
CREATE INDEX idx_uploads_status  ON upload_batches(status);

-- ============================================================
-- INSIGHTS
-- Aggregated, AI-generated summaries surfaced to the UI.
-- Types: theme_summary | trend_alert | weekly_report | anomaly
-- ============================================================

CREATE TABLE insights (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    insight_type     VARCHAR(50) NOT NULL,
    theme            theme_category,
    title            VARCHAR(500) NOT NULL,
    summary          TEXT NOT NULL,
    details          JSONB NOT NULL DEFAULT '{}',
    severity         priority_level,
    review_count     INTEGER DEFAULT 0,
    date_range_start TIMESTAMPTZ,
    date_range_end   TIMESTAMPTZ,
    is_read          BOOLEAN DEFAULT false,
    is_dismissed     BOOLEAN DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insights_project ON insights(project_id);
CREATE INDEX idx_insights_type    ON insights(project_id, insight_type);
CREATE INDEX idx_insights_unread  ON insights(project_id, is_read) WHERE is_read = false;
CREATE INDEX idx_insights_date    ON insights(project_id, created_at DESC);

-- ============================================================
-- SAVED SEARCHES
-- User-saved filter combinations for quick re-access.
-- ============================================================

CREATE TABLE saved_searches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    filters     JSONB NOT NULL,  -- {sentiment, theme, priority, date_range, search_query}
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHAT HISTORY (RAG conversation logs)
-- ============================================================

CREATE TABLE chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
    content         TEXT NOT NULL,
    source_reviews  JSONB,   -- referenced review IDs for citations
    token_count     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- ============================================================
-- ANALYTICS SNAPSHOTS
-- Pre-computed daily rollups for fast dashboard loading.
-- Avoids re-aggregating thousands of rows on every page load.
-- ============================================================

CREATE TABLE analytics_daily (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    total_reviews       INTEGER DEFAULT 0,
    avg_rating          FLOAT,
    sentiment_positive  INTEGER DEFAULT 0,
    sentiment_negative  INTEGER DEFAULT 0,
    sentiment_neutral   INTEGER DEFAULT 0,
    sentiment_mixed     INTEGER DEFAULT 0,
    top_themes          JSONB,  -- [{theme, count, avg_sentiment}]
    top_issues          JSONB,  -- [{issue, count, priority}]
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, date)
);

CREATE INDEX idx_analytics_daily_project ON analytics_daily(project_id, date DESC);

-- ============================================================
-- ACTIVITY LOG (audit trail)
-- ============================================================

CREATE TABLE activity_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_project ON activity_log(project_id, created_at DESC);
```

---

### 4.6 API Design

All endpoints follow this convention:

```
Base URL:      /api/v1
Content-Type:  application/json
Auth:          Bearer token (JWT)

Standard Success Response:
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}

Standard Error Response:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": { "field": "review_text", "issue": "required" }
  }
}
```

#### Authentication

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

**POST /api/v1/auth/register**

```json
// Request:
{
  "email": "pm@company.com",
  "name": "Jane Smith",
  "password": "SecureP@ss123"
}

// Response (201):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "pm@company.com",
      "name": "Jane Smith",
      "role": "viewer"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_at": "2026-07-18T12:00:00Z"
  }
}

// Validation:
// - email: valid format, unique, max 255 chars
// - name: required, 2–255 chars
// - password: min 8 chars, uppercase + number + special char

// Errors:
// - 409 DUPLICATE_EMAIL    — email already registered
// - 422 VALIDATION_ERROR   — invalid input
```

#### Projects

```
GET    /api/v1/projects              — list user's projects
POST   /api/v1/projects              — create project
GET    /api/v1/projects/:id          — get project details
PATCH  /api/v1/projects/:id          — update project
DELETE /api/v1/projects/:id          — delete project
```

#### Review Ingestion

```
POST   /api/v1/projects/:id/reviews/upload     — upload CSV
GET    /api/v1/projects/:id/reviews             — list reviews (paginated, filterable)
GET    /api/v1/projects/:id/reviews/:reviewId   — get single review
GET    /api/v1/projects/:id/uploads             — list upload batches
GET    /api/v1/projects/:id/uploads/:batchId    — get upload status
```

**POST /api/v1/projects/:id/reviews/upload**

```
Content-Type: multipart/form-data

Fields:
- file:            CSV file (required, max 50MB)
- source:          "csv_upload" (default)
- column_mapping:  JSON (optional)
  {
    "review_text":  "feedback",
    "rating":       "stars",
    "review_date":  "date",
    "author_name":  "user"
  }
```

```json
// Response (202 Accepted):
{
  "success": true,
  "data": {
    "batch_id": "uuid",
    "filename": "reviews_june_2026.csv",
    "total_rows": 4523,
    "status": "pending",
    "estimated_processing_time": "~12 minutes",
    "progress_url": "/api/v1/projects/proj-id/uploads/batch-id"
  }
}

// Errors:
// - 400 INVALID_FILE     — not a valid CSV
// - 413 FILE_TOO_LARGE   — exceeds 50MB
// - 422 MISSING_COLUMNS  — review_text column not found
```

**GET /api/v1/projects/:id/reviews — Query Parameters**

```
page:                 number (default: 1)
limit:                number (default: 50, max: 200)
sentiment:            positive | negative | neutral | mixed
theme:                payment | performance | usability | ...
priority:             critical | high | medium | low
source:               csv_upload | app_store | ...
rating:               1–5
date_from:            ISO-8601
date_to:              ISO-8601
search:               string (full-text search)
sort:                 date | rating | priority
order:                asc | desc (default: desc)
is_bug:               boolean
is_feature_request:   boolean
actionable:           boolean
```

#### Analytics

```
GET    /api/v1/projects/:id/analytics/overview    — dashboard summary
GET    /api/v1/projects/:id/analytics/trends       — sentiment trends over time
GET    /api/v1/projects/:id/analytics/themes        — theme distribution
GET    /api/v1/projects/:id/analytics/priority      — priority breakdown
GET    /api/v1/projects/:id/analytics/sources       — source distribution
```

**GET /api/v1/projects/:id/analytics/overview — Sample Response**

```json
{
  "success": true,
  "data": {
    "period": "30d",
    "total_reviews": 4523,
    "reviews_change_pct": 12.5,
    "avg_rating": 3.4,
    "rating_change": -0.3,
    "sentiment_breakdown": {
      "positive": 1823,
      "negative": 1456,
      "neutral": 890,
      "mixed": 354
    },
    "top_themes": [
      { "theme": "payment", "count": 876, "avg_sentiment": -0.7, "trend": "worsening" },
      { "theme": "performance", "count": 654, "avg_sentiment": -0.5, "trend": "stable" },
      { "theme": "usability", "count": 432, "avg_sentiment": 0.2, "trend": "improving" }
    ],
    "critical_issues": 23,
    "critical_issues_change": 5,
    "reviews_today": 127,
    "processing_queue_depth": 0
  }
}
```

#### AI Chat (RAG)

```
GET    /api/v1/projects/:id/chat/sessions                — list sessions
POST   /api/v1/projects/:id/chat/sessions                — create session
POST   /api/v1/projects/:id/chat/sessions/:id/messages    — send message
GET    /api/v1/projects/:id/chat/sessions/:id/messages    — get history
```

**POST /api/v1/projects/:id/chat/sessions/:id/messages — Sample Exchange**

```json
// Request:
{
  "message": "Why have ratings dropped in the last 2 weeks?",
  "context_filters": {
    "theme": "payment",
    "sentiment": "negative"
  }
}

// Response (200):
{
  "success": true,
  "data": {
    "message_id": "uuid",
    "role": "assistant",
    "content": "Ratings over the past 2 weeks have declined primarily due to payment-related issues following your June 1st release. Key findings:\n\n**Top Issue:** 340 reviews mention payment failures (89% negative). Most common complaints:\n1. Checkout crashes after entering card details — 156 mentions\n2. 'Payment declined' errors despite valid cards — 98 mentions\n3. Double charges — reported by 47 users\n\n**Trend:** Payment complaints went from ~5/day before June 1st to ~42/day after — a 740% increase.\n\n**Recommended Action:** This is your #1 engineering priority. Payment issues alone are driving ~40% of all negative reviews this period.",
    "source_reviews": [
      { "id": "uuid", "text": "Tried to checkout 3 times, keeps saying payment failed...", "rating": 1, "date": "2026-06-10" },
      { "id": "uuid", "text": "Got charged twice for the same order...", "rating": 1, "date": "2026-06-12" }
    ],
    "confidence": 0.92,
    "related_themes": ["payment", "reliability"],
    "token_usage": {
      "prompt_tokens": 3200,
      "completion_tokens": 450,
      "total_tokens": 3650
    }
  }
}
```

#### Insights

```
GET    /api/v1/projects/:id/insights                — list insights
GET    /api/v1/projects/:id/insights/:insightId     — get detail
PATCH  /api/v1/projects/:id/insights/:insightId     — mark read/dismissed
POST   /api/v1/projects/:id/insights/generate       — trigger manual generation
```

#### Server-Sent Events (Real-time Updates)

```
GET    /api/v1/projects/:id/events

Events emitted:
- review.processing_progress   { batch_id, processed, total, percentage }
- review.batch_completed       { batch_id, total_reviews, summary }
- insight.generated            { insight_id, type, title, severity }
- analysis.trend_detected      { theme, direction, details }
```

```javascript
// Client usage:
const events = new EventSource('/api/v1/projects/proj-id/events', {
  headers: { Authorization: 'Bearer <token>' },
});

events.addEventListener('review.batch_completed', (e) => {
  const data = JSON.parse(e.data);
  // Update dashboard state
});
```

---

## 5. Data Flow Diagrams

### 5.1 Review Upload Flow

```
User          Frontend         API            Ingestion       Queue          AI Worker       Storage
 │               │               │               │              │               │              │
 │  Upload CSV   │               │               │              │               │              │
 │──────────────▶│               │               │              │               │              │
 │               │  POST /upload │               │              │               │              │
 │               │──────────────▶│               │              │               │              │
 │               │               │  Validate     │              │               │              │
 │               │               │  file         │              │               │              │
 │               │               │──────┐        │              │               │              │
 │               │               │◀─────┘        │              │               │              │
 │               │               │               │              │               │              │
 │               │               │  Store file   │              │               │              │
 │               │               │───────────────────────────────────────────────────────────▶│
 │               │               │               │              │               │              │
 │               │               │  Parse CSV    │              │               │              │
 │               │               │──────────────▶│              │               │              │
 │               │               │               │              │               │              │
 │               │               │               │  Normalize   │               │              │
 │               │               │               │  & dedupe    │               │              │
 │               │               │               │──────┐       │               │              │
 │               │               │               │◀─────┘       │               │              │
 │               │               │               │              │               │              │
 │               │               │               │  Store       │               │              │
 │               │               │               │  reviews     │               │              │
 │               │               │               │───────────────────────────────────────────▶│
 │               │               │               │              │               │              │
 │               │               │               │  Enqueue     │               │              │
 │               │               │               │  analyze job │               │              │
 │               │               │               │─────────────▶│               │              │
 │               │               │               │              │               │              │
 │  202 Accepted │               │               │              │               │              │
 │◀──────────────│◀──────────────│               │              │               │              │
 │               │               │               │              │               │              │
 │               │               │               │              │  Process      │              │
 │               │               │               │              │  batch        │              │
 │               │               │               │              │──────────────▶│              │
 │               │               │               │              │               │              │
 │               │               │               │              │               │  Call Claude │
 │               │               │               │              │               │──────┐       │
 │               │               │               │              │               │◀─────┘       │
 │               │               │               │              │               │              │
 │               │               │               │              │               │  Store       │
 │               │               │               │              │               │  analysis    │
 │               │               │               │              │               │─────────────▶│
 │               │               │               │              │               │              │
 │               │               │               │              │               │  Generate    │
 │               │               │               │              │               │  embeddings  │
 │               │               │               │              │               │─────────────▶│
 │               │               │               │              │               │  (ChromaDB)  │
 │               │               │               │              │               │              │
 │  SSE: progress│               │               │              │               │              │
 │◀──────────────│◀──────────────│◀──────────────│◀─────────────│◀──────────────│              │
 │               │               │               │              │               │              │
 │  SSE: done    │               │               │              │               │              │
 │◀──────────────│◀──────────────│◀──────────────│◀─────────────│◀──────────────│              │
```

---

### 5.2 RAG Chat Flow

```
User         Frontend       API           RAG Engine      ChromaDB      Claude API
 │              │              │               │              │              │
 │ Ask question │              │               │              │              │
 │─────────────▶│              │               │              │              │
 │              │ POST /chat   │               │              │              │
 │              │─────────────▶│               │              │              │
 │              │              │  Embed query  │              │              │
 │              │              │──────────────▶│              │              │
 │              │              │               │  Vector      │              │
 │              │              │               │  search      │              │
 │              │              │               │─────────────▶│              │
 │              │              │               │              │              │
 │              │              │               │  Top-K       │              │
 │              │              │               │  reviews     │              │
 │              │              │               │◀─────────────│              │
 │              │              │               │              │              │
 │              │              │               │  Assemble    │              │
 │              │              │               │  context     │              │
 │              │              │               │──────┐       │              │
 │              │              │               │◀─────┘       │              │
 │              │              │               │              │              │
 │              │              │               │  Generate    │              │
 │              │              │               │  answer      │              │
 │              │              │               │────────────────────────────▶│
 │              │              │               │              │              │
 │              │              │               │  Response    │              │
 │              │              │               │◀────────────────────────────│
 │              │              │               │              │              │
 │              │              │  Answer +     │              │              │
 │              │              │  citations    │              │              │
 │              │              │◀──────────────│              │              │
 │              │              │               │              │              │
 │              │  Response    │               │              │              │
 │              │◀─────────────│               │              │              │
 │  Display     │              │               │              │              │
 │◀─────────────│              │               │              │              │
```

---

### 5.3 Complete Review Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       COMPLETE REVIEW LIFECYCLE                                  │
│                                                                                  │
│  Step 1  INGEST      Raw review enters via CSV / API / source connector          │
│  Step 2  NORMALIZE   Standardized to canonical format, deduplicated              │
│  Step 3  STORE       Persisted to PostgreSQL with status = pending               │
│  Step 4  QUEUE       Job placed on analyze-queue in Redis                        │
│  Step 5  ANALYZE     AI extracts sentiment, theme, priority, summary             │
│  Step 6  UPDATE      Review record updated with AI analysis results              │
│  Step 7  EMBED       Text converted to vector, stored in ChromaDB               │
│  Step 8  AGGREGATE   Analytics counters and trend data recalculated              │
│  Step 9  NOTIFY      SSE event sent to connected clients                         │
│  Step 10 SURFACE     Review appears in filtered queries, insights, chat answers  │
│                                                                                  │
│  Total time per review:  5–15 seconds (depending on batch size and queue depth)  │
│  Bulk (5,000 reviews):   ~6–15 minutes with default worker concurrency           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 1: Transport                                      │    │
│  │  • HTTPS everywhere (TLS 1.3)                            │    │
│  │  • HSTS headers                                          │    │
│  │  • Certificate pinning for API clients                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 2: Authentication                                  │    │
│  │  • JWT tokens (15-min expiry, refresh tokens 7-day)      │    │
│  │  • Bcrypt password hashing (cost factor 12)              │    │
│  │  • Rate limiting: 5 failed logins → 15-min lockout       │    │
│  │  • API key authentication for programmatic access        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 3: Authorization                                   │    │
│  │  • Role-based access control (admin / analyst / viewer)  │    │
│  │  • Project-level scoping — users only access their own   │    │
│  │    project data                                          │    │
│  │  • Permission checks enforced on every API endpoint      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 4: Data Protection                                 │    │
│  │  • PII detection and masking in review text              │    │
│  │  • Encrypted secrets (env vars, never in code)           │    │
│  │  • SQL injection prevention (parameterized queries only) │    │
│  │  • Input sanitization on all user-supplied data          │    │
│  │  • CORS policy (whitelist of allowed origins)            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 5: Rate Limiting & Abuse Prevention               │    │
│  │  • Global:    100 req/min per user                       │    │
│  │  • Upload:      5 uploads/hour per project               │    │
│  │  • Chat:       30 messages/hour per user                 │    │
│  │  • Embeddings: batch-only — no per-request embedding     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Scalability Considerations

| Layer             | Current (MVP)                        | Scaling Strategy                                                                                                                                                                                  |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API**           | Single Next.js instance              | Horizontal scaling behind a load balancer. Next.js handles this natively on Vercel.                                                                                                               |
| **Queue Workers** | Single BullMQ worker process         | Scale workers independently. BullMQ supports distributed workers across multiple processes/machines.                                                                                              |
| **PostgreSQL**    | Single instance (Supabase / Railway) | Read replicas for analytics queries. Connection pooling via PgBouncer. Partition the `reviews` table by date when rows exceed ~10M.                                                               |
| **ChromaDB**      | Single Docker container              | Migrate to Pinecone or Weaviate at scale. ChromaDB is the right MVP choice but has practical limits beyond ~1M vectors.                                                                           |
| **Redis**         | Single instance                      | Redis Cluster for high availability. Separate cache Redis from queue Redis at high load.                                                                                                          |
| **AI Calls**      | Direct synchronous API calls         | Implement request queuing with rate limiting. Cache analysis for identical review text. Consider fine-tuning a smaller model for sentiment/theme classification to reduce per-call cost at scale. |
| **File Storage**  | Local disk → S3-compatible           | S3 with CDN for exports. Scale is effectively unlimited.                                                                                                                                          |

---

## 8. Monitoring & Observability

```
┌──────────────────────────────────────────────────────────────┐
│                   MONITORING STACK                            │
│                                                              │
│  Application Metrics                                         │
│  • Request latency (p50, p95, p99) per endpoint             │
│  • Error rates by endpoint and error code                    │
│  • Active SSE connections                                    │
│  • Authentication failure rates                              │
│                                                              │
│  Pipeline Metrics                                            │
│  • Queue depth per queue (parse / analyze / embed / insight) │
│  • Job processing time per stage                             │
│  • Job failure rate and retry counts                         │
│  • Dead letter queue size                                    │
│                                                              │
│  AI Metrics                                                  │
│  • Claude API latency (p50, p95)                             │
│  • Token usage per request and per project per day           │
│  • Batch sizes and throughput (reviews/minute)               │
│  • Embedding cache hit rate                                  │
│  • Cost per 1,000 reviews analyzed                           │
│                                                              │
│  Business Metrics                                            │
│  • Reviews processed per hour                                │
│  • Active projects and users                                 │
│  • Chat messages per day                                     │
│  • Most queried themes and topics                            │
│  • Insight generation frequency                              │
│                                                              │
│  Tooling                                                     │
│  • Sentry                — error tracking + alerting         │
│  • Prometheus + Grafana  — metrics dashboards                │
│  • Pino (structured logs) → stdout → log aggregator          │
│  • BullMQ Dashboard      — queue monitoring UI               │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Deployment Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                  DEPLOYMENT (MVP)                              │
│                                                               │
│  ┌─────────────────────────────────────┐                      │
│  │           Vercel                     │                      │
│  │  • Next.js app (frontend + API)     │                      │
│  │  • Edge functions for auth          │                      │
│  │  • Automatic CI/CD from Git         │                      │
│  └──────────────┬──────────────────────┘                      │
│                 │                                             │
│  ┌──────────────▼──────────────────────┐                      │
│  │           Railway / Fly.io           │                      │
│  │  • BullMQ worker process            │                      │
│  │  • Background job processing        │                      │
│  │  • Always-on (not serverless)       │                      │
│  └──────────────┬──────────────────────┘                      │
│                 │                                             │
│  ┌──────────────▼──────────────────────┐                      │
│  │        Supabase / Neon               │                      │
│  │  • PostgreSQL database              │                      │
│  │  • Connection pooling               │                      │
│  │  • Automated backups                │                      │
│  └──────────────┬──────────────────────┘                      │
│                 │                                             │
│  ┌──────────────▼──────────────────────┐                      │
│  │        Upstash / Redis Cloud         │                      │
│  │  • Redis for queue + cache          │                      │
│  │  • Serverless-friendly pricing      │                      │
│  └──────────────┬──────────────────────┘                      │
│                 │                                             │
│  ┌──────────────▼──────────────────────┐                      │
│  │        ChromaDB (Docker)             │                      │
│  │  • Self-hosted on Railway / Fly     │                      │
│  │  • Persistent volume for vectors    │                      │
│  └─────────────────────────────────────┘                      │
│                                                               │
│  CI/CD Pipeline:                                              │
│  GitHub → GitHub Actions                                      │
│        → lint + type-check + tests                            │
│        → Vercel (auto-deploy on merge to main)                │
│        → Railway (auto-deploy on merge to main)               │
└───────────────────────────────────────────────────────────────┘
```

---

## 10. Architecture Decision Records (ADRs)

| Decision                 | Choice                     | Alternatives Considered      | Rationale                                                                                                                                      |
| ------------------------ | -------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture pattern** | Modular monolith           | Microservices, serverless    | Small team, MVP stage. Monolith is faster to iterate. Clear module boundaries enable future decomposition without a full rewrite.              |
| **Primary database**     | PostgreSQL                 | MySQL, MongoDB               | Relational model fits well. JSONB provides flexibility. Best ecosystem for complex analytics queries.                                          |
| **Vector database**      | ChromaDB                   | Pinecone, Weaviate, pgvector | Simple, self-hostable, zero external cost at MVP. Will migrate to a managed service when vector count exceeds practical ChromaDB limits (~1M). |
| **Job queue**            | BullMQ + Redis             | SQS, RabbitMQ, Inngest       | Mature, Redis-backed (already needed for caching), excellent monitoring UI, native retry/priority support.                                     |
| **AI model**             | Claude (claude-sonnet-4-5) | GPT-4o, Gemini               | Strong structured JSON output compliance. Large context window for batching. Competitive pricing at this scale.                                |
| **Embedding model**      | Voyage AI `voyage-3`       | OpenAI, Cohere, local models | Best retrieval quality per dollar. OpenAI as fallback. Avoids self-hosting infrastructure.                                                     |
| **Frontend framework**   | Next.js (App Router)       | Remix, SvelteKit, Nuxt       | Best React ecosystem. Server components reduce client bundle. API routes in one deployment reduces infrastructure surface.                     |
| **Real-time delivery**   | Server-Sent Events (SSE)   | WebSockets, polling          | SSE is simpler, sufficient for one-way server→client push, works over HTTP/2, no proxy configuration required.                                 |
| **Authentication**       | Custom JWT                 | NextAuth, Clerk, Auth0       | Full control over roles and project-scoped permissions. Avoids vendor lock-in at MVP. Revisit if auth complexity grows significantly.          |

---

## 11. Intentional Exclusions (MVP Scope)

These capabilities are deliberately out of scope for the initial version and will be re-evaluated as usage scales:

| Excluded                        | Reason                                     | When to Revisit                                                                                                       |
| ------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Microservice decomposition**  | Over-engineering at MVP scale              | When team exceeds 5 engineers or services need independent deployment cycles                                          |
| **Kubernetes**                  | Unnecessary operational complexity         | When deploying across multiple regions or requiring fine-grained auto-scaling                                         |
| **Event sourcing / CQRS**       | Premature optimization                     | When audit requirements demand full event replay or write/read patterns diverge significantly                         |
| **Multi-region deployment**     | Cost and complexity not justified          | When latency requirements are regional or data residency compliance requires it                                       |
| **Custom fine-tuned ML models** | Expensive to train, maintain, and version  | When AI API costs exceed ~$5K/month — at that point, fine-tuning a smaller model for classification is cost-effective |
| **GraphQL**                     | REST is simpler and sufficient             | When frontend query patterns become highly variable and over-fetching/under-fetching becomes a real problem           |
| **WebSockets**                  | SSE covers all current real-time use cases | When bidirectional real-time communication is needed (e.g., collaborative annotation, live cursors)                   |
| **Offline support / PWA**       | Adds significant complexity                | When enterprise customers require offline access to dashboards                                                        |
