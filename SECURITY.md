# ReviewPulse Security Audit & Documentation

This document summarizes the security status, audit findings, implemented fixes, and production security recommendations for ReviewPulse.

## 1. Dependency Vulnerabilities
An audit was performed using `npm audit`.
- **Status:** There are 24 vulnerabilities identified (18 moderate, 3 high, 3 critical).
- **Remediation:** Most of these vulnerabilities require `--force` breaking upgrades of core dependencies like Next.js, `@xenova/transformers`, `app-store-scraper`, or `@mdxeditor/editor`. 
- **Risk Assessment:**
  - **protobufjs (Critical):** Used transitively by `@xenova/transformers` / `onnxruntime-web` for local embedding computation. The risk is minimized as the model loads locally and processes reviews in-process; no untrusted protobuf definitions are parsed from remote clients.
  - **form-data (Critical):** Used by `app-store-scraper` / `request`. This is a build/dev time or administrative dependency. No multipart form data from raw internet requests is parsed directly using the vulnerable version outside of controlled platform ingestion.
  - **postcss (Moderate):** Handled securely by Next.js during build time.

## 2. Environment Security
- **.env File:** The `.env` file containing local dev secrets is correctly configured and excluded in `.gitignore` under the `.env*` rule.
- **.env.example:** Confirmed to contain only placeholders (e.g. `hf_your_token_here` or empty keys) and no real credentials.
- **Hardcoded Secrets:** Codebase was audited for patterns matching `sk-`, `ghp_`, `hf_`, `AKIA`, and password/secret variables. No real keys or credentials are hardcoded. A safe fallback JWT secret is provided for sandbox development only.

## 3. API Route Security
- **Rate Limiting:** Extended the in-memory rate limiting mechanism in `src/middleware.ts`. All mutation endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) are now rate-limited (10 requests per 15 min for auth endpoints; 100 requests per 15 min for all other API mutations per IP).
- **Reseed Security:** Added protection to the `/api/seed` route. Strangers cannot reset the database. Reseeding via `POST` is only permitted if:
  1. The database has 0 users (first-time deploy setup).
  2. The user has a valid active session.
  3. The caller provides the verification header `x-demo-reset: confirm`.
- **Config Protection:** `/api/config/env` only returns configuration status booleans (`configured: true/false`), provider types, and public variables. It does not leak raw tokens or passwords. No `/api/config/test` endpoint exists.

## 4. Input Validation
- All write/mutation API endpoints validate incoming JSON payloads using **Zod schemas** defined in `src/lib/validation.ts`.
- **Ingestion Limit:** `/api/ingest` verifies that CSV/JSON content does not exceed `5MB` (`5 * 1024 * 1024` characters).
- **RAG Chat Limit:** `/api/chat` verifies that the question does not exceed `2000` characters.

## 5. XSS & Injection Prevention
- Checked the codebase for uses of `dangerouslySetInnerHTML` and `innerHTML`.
- The only usage is inside `src/components/ui/chart.tsx` to inject dynamic Tailwind configuration CSS variables inside a `<style>` block, which does not process user-provided strings.
- All review texts and RAG chat responses are escaped and rendered as standard React text elements (`<span>`), preventing raw HTML parsing or script execution.

## 6. Production Security Recommendations
For production deployments, the following additional steps should be taken:
1. **Database Vector Search:** Migrate vector storage from local memory/SQLite JSON strings to a PostgreSQL database with the `pgvector` extension and configure an HNSW index.
2. **Distributed Rate Limiting:** Swap the in-memory rate limiter in `src/middleware.ts` with an Upstash/Redis-backed rate limiter to handle multi-instance server deployments.
3. **Upgrade Dependencies:** Perform breaking upgrades in a staging environment to resolve all critical/high dependency warnings once stable compatibility with the framework is verified.
