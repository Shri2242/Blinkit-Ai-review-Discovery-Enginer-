import crypto from 'crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { db, apiKeys, activityLog } from '@review-engine/database';

import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';

// Helper to hash key with SHA-256
export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export async function generateKey(
  projectId: string,
  userId: string,
  data: { name: string; scopes: string[] }
) {
  // Validate scopes
  const allowedScopes = ['read', 'write', 'admin'];
  const invalidScopes = data.scopes.filter((s) => !allowedScopes.includes(s));
  if (invalidScopes.length > 0) {
    throw new ValidationError(`Invalid scopes: ${invalidScopes.join(', ')}`);
  }

  // Generate 32 random bytes as hex (64 hex characters)
  const randomHex = crypto.randomBytes(32).toString('hex');
  const rawKey = `sk_live_${randomHex}`;

  // SHA-256 hash the full key
  const keyHash = hashKey(rawKey);

  // Prefix: first 16 characters of the raw key (sk_live_ + first 8 hex chars)
  const keyPrefix = rawKey.substring(0, 16);

  const [newKey] = await db
    .insert(apiKeys)
    .values({
      projectId,
      userId,
      name: data.name,
      keyHash,
      keyPrefix,
      scopes: data.scopes,
    })
    .returning();

  await db.insert(activityLog).values({
    userId,
    projectId,
    action: 'apikey.created',
    entityType: 'api_key',
    entityId: newKey!.id,
    details: { name: data.name, scopes: data.scopes },
  });

  return {
    id: newKey!.id,
    name: newKey!.name,
    key_prefix: keyPrefix,
    scopes: newKey!.scopes,
    created_at: newKey!.createdAt,
    raw_key: rawKey,
  };
}

export async function listKeys(projectId: string) {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.projectId, projectId), isNull(apiKeys.revokedAt)))
    .orderBy(apiKeys.createdAt);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    key_prefix: `${row.keyPrefix.substring(0, 8)}xxxx...xxxx${row.keyPrefix.substring(12)}`,
    scopes: row.scopes,
    last_used_at: row.lastUsedAt,
    created_at: row.createdAt,
  }));
}

export async function revokeKey(projectId: string, keyId: string): Promise<void> {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)))
    .limit(1);

  if (!key) {
    throw new NotFoundError('API key not found');
  }

  if (key.revokedAt) {
    throw new ConflictError('Key is already revoked');
  }

  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));

  await db.insert(activityLog).values({
    userId: key.userId,
    projectId,
    action: 'apikey.revoked',
    entityType: 'api_key',
    entityId: keyId,
  });
}

export async function validateKey(rawKey: string) {
  const keyHash = hashKey(rawKey);

  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);

  if (!key) {
    return null;
  }

  if (key.revokedAt) {
    return null;
  }

  if (key.expiresAt && key.expiresAt < new Date()) {
    return null;
  }

  const now = new Date();
  await db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, key.id));

  return {
    projectId: key.projectId,
    userId: key.userId,
    scopes: key.scopes,
    keyId: key.id,
  };
}
