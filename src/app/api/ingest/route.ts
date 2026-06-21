import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

interface NormalizedReview {
  text: string;
  title: string | null;
  rating: number;
  source: string;
  author: string;
  sourceReviewId: string | null;
}

/** Parse a CSV string into rows. Supports quoted fields with commas. */
function parseCSV(input: string): Record<string, string>[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = false;
        } else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") {
          out.push(cur);
          cur = "";
        } else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

function normalizeRow(row: Record<string, unknown>): NormalizedReview | null {
  const get = (keys: string[]) => {
    for (const k of keys) {
      const lk = k.toLowerCase();
      const found = Object.keys(row).find((rk) => rk.toLowerCase() === lk);
      if (found && row[found] != null && String(row[found]).trim() !== "") return String(row[found]).trim();
    }
    return null;
  };
  const text = get(["text", "review", "content", "body", "message"]);
  if (!text) return null;
  const ratingRaw = get(["rating", "stars", "score"]);
  let rating = 3;
  if (ratingRaw) {
    const n = parseInt(ratingRaw, 10);
    if (!Number.isNaN(n)) rating = Math.max(1, Math.min(5, n));
  }
  const source = get(["source", "platform", "channel"]) || "csv_upload";
  const author = get(["author", "user", "username", "name"]) || "Anonymous";
  const title = get(["title", "subject", "headline"]);
  const external = get(["source_review_id", "external_id", "id", "review_id"]);
  return {
    text,
    title,
    rating,
    source: ["google_play", "app_store", "reddit", "twitter", "csv_upload"].includes(source)
      ? source
      : "csv_upload",
    author,
    sourceReviewId: external,
  };
}

// POST /api/ingest — parse a CSV or JSON payload and insert reviews.
// Body: { content: string, format: "csv" | "json" }
export async function POST(req: NextRequest) {
  try {
    const project = await ensureProject();
    const body = await req.json().catch(() => ({}));
    const content = typeof body?.content === "string" ? body.content : "";
    const format = body?.format === "json" ? "json" : "csv";

    if (!content.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    let rows: Record<string, unknown>[] = [];
    if (format === "json") {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) rows = parsed as Record<string, unknown>[];
      else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { reviews?: unknown }).reviews))
        rows = (parsed as { reviews: Record<string, unknown>[] }).reviews;
      else return NextResponse.json({ error: "JSON must be an array or { reviews: [...] }" }, { status: 400 });
    } else {
      rows = parseCSV(content);
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const errorSamples: string[] = [];

    for (const row of rows) {
      const n = normalizeRow(row);
      if (!n) {
        errors++;
        if (errorSamples.length < 3) errorSamples.push("Row missing required 'text' field.");
        continue;
      }
      const contentHash = createHash("sha256").update(n.text).digest("hex");
      // Dedup by sourceReviewId or contentHash
      const dup =
        n.sourceReviewId
          ? await db.review.findFirst({ where: { projectId: project.id, sourceReviewId: n.sourceReviewId } })
          : null;
      const dupHash = await db.review.findFirst({ where: { projectId: project.id, contentHash } });
      if (dup || dupHash) {
        skipped++;
        continue;
      }
      await db.review.create({
        data: {
          projectId: project.id,
          text: n.text,
          title: n.title,
          rating: n.rating,
          reviewDate: new Date(),
          source: n.source,
          author: n.author,
          sourceReviewId: n.sourceReviewId ?? `${n.source}:${contentHash.slice(0, 12)}`,
          contentHash,
          processed: false,
        },
      });
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted, skipped, errors, errorSamples, totalRows: rows.length });
  } catch (err) {
    console.error("[api/ingest] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
