"use client";

import type {
  Review,
  Stats,
  Segments,
  Insights,
  CollectorSource,
  ChatResult,
} from "./types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => jsonFetch<{ status: string; time: string }>("/api/health"),

  seedStatus: () => jsonFetch<{ seeded: boolean; projectCount: number; reviewCount: number; sourceCount: number }>("/api/seed"),
  seed: () => jsonFetch<{ ok: boolean; reviewsInserted: number; sourcesInserted: number; project: { id: string; name: string } }>(`/api/seed`, { method: "POST" }),

  stats: () => jsonFetch<Stats>("/api/stats"),

  reviews: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    }
    return jsonFetch<{ reviews: Review[]; total: number; limit: number; offset: number }>(`/api/reviews?${sp.toString()}`);
  },

  segments: () => jsonFetch<Segments>("/api/segments"),
  insights: () => jsonFetch<Insights>("/api/insights"),

  sources: () => jsonFetch<{ sources: CollectorSource[] }>("/api/sources"),
  createSource: (data: { sourceType: string; name: string; config: Record<string, unknown>; schedule?: string }) =>
    jsonFetch<{ ok: boolean; source: { id: string } }>("/api/sources", { method: "POST", body: JSON.stringify(data) }),
  collect: (sourceId?: string) =>
    jsonFetch<{ ok: boolean; results: { sourceId: string; name: string; fetched?: number; new?: number; duplicate?: number; error?: string }[] }>("/api/collect", { method: "POST", body: JSON.stringify({ sourceId }) }),

  ingest: (content: string, format: "csv" | "json") =>
    jsonFetch<{ ok: boolean; inserted: number; skipped: number; errors: number; errorSamples: string[]; totalRows: number }>("/api/ingest", { method: "POST", body: JSON.stringify({ content, format }) }),

  analyze: (limit = 20) =>
    jsonFetch<{ ok: boolean; processed: number; message?: string }>("/api/analyze", { method: "POST", body: JSON.stringify({ limit }) }),

  chat: (question: string) =>
    jsonFetch<ChatResult>("/api/chat", { method: "POST", body: JSON.stringify({ question }) }),
};

export const SOURCE_LABELS: Record<string, string> = {
  google_play: "Google Play",
  app_store: "App Store",
  reddit: "Reddit",
  twitter: "Twitter / X",
  csv_upload: "CSV Upload",
};

export const THEME_LABELS: Record<string, string> = {
  music_discovery: "Music Discovery",
  recommendation_quality: "Recommendation Quality",
  playlist_fatigue: "Playlist Fatigue",
  playback_bug: "Playback Bug",
  ui_ux: "UI / UX",
  search: "Search",
  offline_mode: "Offline Mode",
  pricing: "Pricing",
  social_features: "Social Features",
  audio_quality: "Audio Quality",
  general: "General",
  unknown: "Unknown",
};

export function themeLabel(t: string | null | undefined): string {
  if (!t) return "Unlabeled";
  return THEME_LABELS[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sentimentColor(s: string | null | undefined): string {
  switch (s) {
    case "positive": return "var(--rp-positive)";
    case "negative": return "var(--rp-negative)";
    case "neutral": return "var(--rp-neutral)";
    case "mixed": return "var(--rp-mixed)";
    default: return "var(--rp-neutral)";
  }
}

export function priorityColor(p: string | null | undefined): string {
  switch (p) {
    case "critical": return "var(--rp-critical)";
    case "high": return "var(--rp-high)";
    case "medium": return "var(--rp-medium)";
    case "low": return "var(--rp-low)";
    default: return "var(--rp-neutral)";
  }
}

export function sourceIconKey(s: string): string {
  return s;
}
