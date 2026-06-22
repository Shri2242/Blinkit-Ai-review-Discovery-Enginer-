-- ReviewPulse — pgvector setup for PostgreSQL
-- =====================================================================
-- Run this AFTER `bunx prisma db push` (which creates the
-- `review_embeddings` table from prisma/schema.postgres.prisma).
--
-- Why this file exists:
--   Prisma cannot yet declare a `vector` column type natively, so the
--   schema marks `ReviewEmbedding.embedding` as `Unsupported("vector(384)")`.
--   That makes Prisma skip the column during `db push`. We create the
--   extension + the column + an IVFFlat index here by hand.
--
-- How to run:
--   psql "$DATABASE_URL" -f prisma/add-pgvector.sql
--   # or, with Neon/Supabase/Railway, paste this into their SQL editor.
--
-- After running this, all vector reads/writes go through raw SQL via
-- `prisma.$queryRaw` / `prisma.$executeRaw` using the cosine operator `<=>`.
-- Example nearest-neighbor query (k=10):
--   SELECT review_id
--   FROM review_embeddings
--   ORDER BY embedding_vec <=> $1::vector
--   LIMIT 10;
-- =====================================================================

-- 1) Enable the pgvector extension (idempotent).
--    On Neon: enabled by default. On Supabase: enabled by default.
--    On self-hosted Postgres: `CREATE EXTENSION vector;` requires the
--    `vector` package to be installed on the server first.
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Add the vector column. We use a separate name (`embedding_vec`) to
--    avoid colliding with anything Prisma might try to manage later and to
--    make it obvious in queries that this column uses the pgvector type.
--    384 matches `xenova/all-MiniLM-L6-v2` (the model used by src/lib/embeddings.ts).
ALTER TABLE review_embeddings
  ADD COLUMN IF NOT EXISTS embedding_vec vector(384);

-- 3) Build an IVFFlat index for fast approximate nearest-neighbor search
--    using cosine similarity (the `<=>` operator).
--    `lists = 100` is a reasonable starting point for up to ~100k rows.
--    Rule of thumb from the pgvector docs: lists ≈ rows / 1000.
--    For >1M rows, bump lists to ~sqrt(rows) and consider HNSW instead:
--      CREATE INDEX ... ON review_embeddings USING hnsw (embedding_vec vector_cosine_ops);
--    IMPORTANT: IVFFlat indexes must be built AFTER the table has data, OR
--    you must run `ANALYZE review_embeddings;` after the first bulk load
--    so the index is populated. Re-run this statement anytime you do a
--    large bulk re-embedding to rebuild the index.
CREATE INDEX IF NOT EXISTS review_embeddings_embedding_vec_idx
  ON review_embeddings
  USING ivfflat (embedding_vec vector_cosine_ops)
  WITH (lists = 100);

-- 4) Refresh planner stats so the new index is picked up immediately.
ANALYZE review_embeddings;
