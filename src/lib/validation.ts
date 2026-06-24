/**
 * ReviewPulse — Zod validation schemas for all API write endpoints.
 * Server-only. Used by every mutation route to validate input before touching the DB.
 */
import { z } from "zod";

// Password policy: 8+ chars, at least one uppercase, one lowercase, one number, one special.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Valid email is required").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(PASSWORD_REGEX, "Password must include uppercase, lowercase, number, and special character"),
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["admin", "analyst", "viewer"]).default("analyst"),
});

export const updateRoleSchema = z.object({
  role: z.enum(["admin", "analyst", "viewer"]),
});

export const createSourceSchema = z.object({
  sourceType: z.enum(["google_play", "app_store", "reddit", "twitter"]),
  name: z.string().min(1).max(255),
  config: z.record(z.string(), z.unknown()).default({}),
  schedule: z.string().max(120).default("0 9 * * *"),
  enabled: z.boolean().default(true),
});

export const ingestSchema = z.object({
  content: z.string().min(1, "content is required").max(5 * 1024 * 1024), // 5MB
  format: z.enum(["csv", "json"]).default("csv"),
});

export const analyzeSchema = z.object({
  limit: z.number().int().min(1).max(500).default(50),
});

export const chatSchema = z.object({
  question: z.string().min(1, "question is required").max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
});

export const collectSchema = z.object({
  sourceId: z.string().nullable().optional(),
  skipAutoProcess: z.boolean().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
});

export const reviewQuerySchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]).optional(),
  source: z
    .enum(["google_play", "app_store", "reddit", "twitter", "csv_upload"])
    .optional(),
  theme: z.string().max(100).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  isBug: z.enum(["true", "false"]).optional(),
  isFeatureRequest: z.enum(["true", "false"]).optional(),
  search: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
