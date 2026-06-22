"use client";

import type {
  Review,
  Stats,
  Segments,
  Insights,
  CollectorSource,
  ChatResult,
} from "./types";

/** Build a URL with an optional projectId query param. */
function withProject(path: string, projectId?: string | null): string {
  if (!projectId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}projectId=${encodeURIComponent(projectId)}`;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      if (body?.issues?.length) message = body.issues.map((i: { message: string }) => i.message).join("; ");
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  authProvider?: string;
}
export interface AuthProject {
  id: string;
  name: string;
  description: string | null;
  role: string;
}

export const api = {
  health: () => jsonFetch<{ status: string; time: string }>("/api/health"),

  /* ---- Auth ---- */
  register: (data: { name: string; email: string; password: string }) =>
    jsonFetch<{ ok: boolean; user: AuthUser; project: { id: string; name: string } }>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    jsonFetch<{ ok: boolean; user: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => jsonFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => jsonFetch<{ user: AuthUser | null; projects: AuthProject[] }>("/api/auth/me"),
  guest: () => jsonFetch<{ ok: boolean; user: AuthUser; project: { id: string; name: string } }>("/api/auth/guest", { method: "POST" }),
  setupStatus: () => jsonFetch<{ needsSetup: boolean; userCount: number }>("/api/auth/setup"),
  setup: () => jsonFetch<{ ok: boolean; user: AuthUser; project: { id: string; name: string }; demoCredentials: { email: string; password: string } }>("/api/auth/setup", { method: "POST" }),
  googleStatus: () => jsonFetch<{ ok: boolean; configured: boolean; error?: string; setup?: unknown }>("/api/auth/google"),
  phoneSend: (phone: string) =>
    jsonFetch<{ ok: boolean; sent: boolean; devMode: boolean; devCode?: string; hint?: string; expiresIn: number }>("/api/auth/phone/send", { method: "POST", body: JSON.stringify({ phone }) }),
  phoneVerify: (phone: string, code: string) =>
    jsonFetch<{ ok: boolean; user: AuthUser }>("/api/auth/phone/verify", { method: "POST", body: JSON.stringify({ phone, code }) }),

  /* ---- Projects ---- */
  listProjects: () => jsonFetch<{ projects: AuthProject[] }>("/api/projects"),
  createProject: (data: { name: string; description?: string }) =>
    jsonFetch<{ ok: boolean; project: AuthProject }>("/api/projects", { method: "POST", body: JSON.stringify(data) }),

  /* ---- Seed (dev) ---- */
  seedStatus: () => jsonFetch<{ seeded: boolean; projectCount: number; reviewCount: number; sourceCount: number; userCount: number; embeddingCount: number }>("/api/seed"),
  seed: () => jsonFetch<{ ok: boolean; reviewsInserted: number; sourcesInserted: number; project: { id: string; name: string }; user: AuthUser | null; demoCredentials: { email: string; password: string } }>(`/api/seed`, { method: "POST" }),

  /* ---- Data (project-scoped where it matters) ---- */
  stats: (projectId?: string | null) => jsonFetch<Stats>(withProject("/api/stats", projectId)),

  reviews: (params: Record<string, string | number | boolean | undefined> = {}, projectId?: string | null) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    }
    const base = `/api/reviews?${sp.toString()}`;
    return jsonFetch<{ reviews: Review[]; total: number; limit: number; offset: number }>(withProject(base, projectId));
  },

  segments: (projectId?: string | null) => jsonFetch<Segments>(withProject("/api/segments", projectId)),
  insights: (projectId?: string | null) => jsonFetch<Insights>(withProject("/api/insights", projectId)),

  sources: (projectId?: string | null) => jsonFetch<{ sources: CollectorSource[] }>(withProject("/api/sources", projectId)),
  createSource: (data: { sourceType: string; name: string; config: Record<string, unknown>; schedule?: string }, projectId?: string | null) =>
    jsonFetch<{ ok: boolean; source: { id: string } }>(withProject("/api/sources", projectId), { method: "POST", body: JSON.stringify(data) }),
  collect: (sourceId?: string, projectId?: string | null) =>
    jsonFetch<{ ok: boolean; results: { sourceId: string; name: string; fetched?: number; new?: number; duplicate?: number; real?: boolean; error?: string }[] }>(withProject("/api/collect", projectId), { method: "POST", body: JSON.stringify({ sourceId }) }),

  ingest: (content: string, format: "csv" | "json", projectId?: string | null) =>
    jsonFetch<{ ok: boolean; inserted: number; skipped: number; errors: number; errorSamples: string[]; totalRows: number }>(withProject("/api/ingest", projectId), { method: "POST", body: JSON.stringify({ content, format }) }),

  analyze: (limit = 20, projectId?: string | null) =>
    jsonFetch<{ ok: boolean; processed: number; message?: string }>(withProject("/api/analyze", projectId), { method: "POST", body: JSON.stringify({ limit }) }),

  embed: (limit = 50, projectId?: string | null) =>
    jsonFetch<{ ok: boolean; embedded: number; neural: boolean; model: string; dimensions: number; message?: string }>(withProject("/api/embed", projectId), { method: "POST", body: JSON.stringify({ limit }) }),
  embedStatus: (projectId?: string | null) =>
    jsonFetch<{ withEmbedding: number; processed: number; coverage: number; neural: boolean; model: string; dimensions: number }>(withProject("/api/embed", projectId)),

  chat: (question: string, projectId?: string | null) =>
    jsonFetch<ChatResult & { embeddedCount: number; vectorSearch: boolean }>(withProject("/api/chat", projectId), { method: "POST", body: JSON.stringify({ question }) }),

  /* ---- Team ---- */
  listMembers: (projectId?: string | null) => jsonFetch<{ members: { id: string; userId: string; name: string; email: string; role: string; addedAt: string }[] }>(withProject("/api/team", projectId)),
  inviteMember: (data: { email: string; name: string; role: "admin" | "analyst" | "viewer" }, projectId?: string | null) =>
    jsonFetch<{ ok: boolean; member: { id: string; userId: string; name: string; email: string; role: string } }>(withProject("/api/team", projectId), { method: "POST", body: JSON.stringify(data) }),
  updateMemberRole: (userId: string, role: "admin" | "analyst" | "viewer", projectId?: string | null) =>
    jsonFetch<{ ok: boolean; member: { id: string; role: string } }>(withProject(`/api/team/${userId}`, projectId), { method: "PATCH", body: JSON.stringify({ role }) }),
  removeMember: (userId: string, projectId?: string | null) =>
    jsonFetch<{ ok: boolean }>(withProject(`/api/team/${userId}`, projectId), { method: "DELETE" }),

  /* ---- API Keys ---- */
  listApiKeys: () => jsonFetch<{ keys: { id: string; name: string; prefix: string; lastUsedAt: string | null; createdAt: string }[] }>("/api/apikeys"),
  createApiKey: (name: string) =>
    jsonFetch<{ ok: boolean; key: { id: string; name: string; raw: string; prefix: string; createdAt: string } }>("/api/apikeys", { method: "POST", body: JSON.stringify({ name }) }),
  revokeApiKey: (id: string) => jsonFetch<{ ok: boolean }>(`/api/apikeys/${id}`, { method: "DELETE" }),

  /* ---- Reviews management ---- */
  clearReviews: (projectId?: string | null) =>
    jsonFetch<{ ok: boolean; deleted: number }>(withProject("/api/reviews/clear", projectId), { method: "DELETE" }),

  /* ---- Chat history ---- */
  chatHistory: (projectId?: string | null) =>
    jsonFetch<{ messages: { id: string; role: string; content: string; metadata: unknown; createdAt: string }[] }>(withProject("/api/chat/history", projectId)),
  clearChatHistory: (projectId?: string | null) =>
    jsonFetch<{ ok: boolean }>(withProject("/api/chat/history", projectId), { method: "DELETE" }),

  /* ---- Report schedules ---- */
  listSchedules: (projectId?: string | null) =>
    jsonFetch<{ schedules: { id: string; name: string; frequency: string; recipients: string[]; enabled: boolean; includeSentiment: boolean; includeThemes: boolean; includeTopIssues: boolean; includeSummary: boolean; lastSentAt: string | null; nextSendAt: string | null; createdAt: string }[] }>(withProject("/api/reports/schedules", projectId)),
  createSchedule: (data: { name: string; frequency: "daily" | "weekly" | "monthly"; recipients: string[]; includeSentiment?: boolean; includeThemes?: boolean; includeTopIssues?: boolean; includeSummary?: boolean; enabled?: boolean }, projectId?: string | null) =>
    jsonFetch<{ ok: boolean; schedule: { id: string } }>(withProject("/api/reports/schedules", projectId), { method: "POST", body: JSON.stringify(data) }),
  deleteSchedule: (id: string, projectId?: string | null) =>
    jsonFetch<{ ok: boolean }>(withProject(`/api/reports/schedules/${id}`, projectId), { method: "DELETE" }),

  /* ---- Webhooks ---- */
  listWebhooks: (projectId?: string | null) =>
    jsonFetch<{ webhooks: { id: string; name: string; url: string; events: string[]; enabled: boolean; failureCount: number; lastTriggeredAt: string | null; lastStatusCode: number | null; createdAt: string; deliveryCount: number }[] }>(withProject("/api/reports/webhooks", projectId)),
  createWebhook: (data: { name: string; url: string; events: string[]; enabled?: boolean }, projectId?: string | null) =>
    jsonFetch<{ ok: boolean; webhook: { id: string; name: string; url: string; secret: string } }>(withProject("/api/reports/webhooks", projectId), { method: "POST", body: JSON.stringify(data) }),
  deleteWebhook: (id: string, projectId?: string | null) =>
    jsonFetch<{ ok: boolean }>(withProject(`/api/reports/webhooks/${id}`, projectId), { method: "DELETE" }),

  /* ---- Saved searches ---- */
  listSavedSearches: (projectId?: string | null) =>
    jsonFetch<{ searches: { id: string; name: string; filters: Record<string, unknown>; createdAt: string }[] }>(withProject("/api/searches", projectId)),
  saveSearch: (data: { name: string; filters: Record<string, unknown> }, projectId?: string | null) =>
    jsonFetch<{ ok: boolean; search: { id: string } }>(withProject("/api/searches", projectId), { method: "POST", body: JSON.stringify(data) }),
  deleteSearch: (id: string) => jsonFetch<{ ok: boolean }>(`/api/searches/${id}`, { method: "DELETE" }),

  /* ---- Config / env status ---- */
  envStatus: () => jsonFetch<{
    database: { configured: boolean; provider: string; isProduction: boolean };
    jwtSecret: { configured: boolean };
    ai: { deepseek: { configured: boolean; baseUrl: string }; zai: { configured: boolean; note: string } };
    embeddings: { model: string; local: boolean; note: string };
    auth: { google: { configured: boolean }; twilio: { configured: boolean }; email: { configured: boolean; note: string }; guest: { configured: boolean; note: string }; firebase: { configured: boolean }; resend: { configured: boolean } };
    redis: { configured: boolean };
    appUrl: string | null;
    nodeEnv: string;
  }>("/api/config/env"),

  /* ---- Test a specific integration's connection ---- */
  testConnection: (service: "deepseek" | "twilio" | "resend" | "firebase" | "google" | "postgres", payload?: Record<string, unknown>) =>
    jsonFetch<{ ok: boolean; message: string; details?: unknown }>("/api/config/test", { method: "POST", body: JSON.stringify({ service, payload }) }),
};

export const SOURCE_LABELS: Record<string, string> = {
  google_play: "Google Play",
  app_store: "App Store",
  reddit: "Reddit",
  twitter: "Twitter / X",
  csv_upload: "CSV Upload",
};

export const THEME_LABELS: Record<string, string> = {
  payment: "Payment",
  performance: "Performance",
  usability: "Usability",
  onboarding: "Onboarding",
  features: "Features",
  support: "Support",
  pricing: "Pricing",
  security: "Security",
  reliability: "Reliability",
  content: "Content",
  other: "Other",
  general: "Other",
  unknown: "Other",
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
