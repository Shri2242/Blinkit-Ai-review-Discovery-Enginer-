import crypto from 'crypto';

import { and, desc, eq } from 'drizzle-orm';

import { db, webhookConfigs, webhookDeliveries, activityLog } from '@review-engine/database';

import { createWebhookSchema, updateWebhookSchema } from './report.schema.js';
import { NotFoundError } from '../../lib/errors.js';

export async function createWebhook(projectId: string, userId: string, data: unknown) {
  const validated = createWebhookSchema.parse(data);

  // Generate a random secret for HMAC signing (32 bytes hex)
  const secret = crypto.randomBytes(32).toString('hex');

  const [config] = await db
    .insert(webhookConfigs)
    .values({
      project_id: projectId,
      created_by: userId,
      name: validated.name,
      url: validated.url,
      secret,
      events: validated.events,
      enabled: validated.enabled,
    })
    .returning();

  if (!config) {
    throw new Error('Failed to create webhook configuration');
  }

  // Log activity
  await db.insert(activityLog).values({
    userId,
    projectId,
    action: 'webhook.created',
    entityType: 'webhook',
    entityId: config.id,
    details: { name: config.name, url: config.url },
  });

  return config; // contains secret
}

export async function listWebhooks(projectId: string) {
  // Do NOT return the secret field
  return db
    .select({
      id: webhookConfigs.id,
      project_id: webhookConfigs.project_id,
      created_by: webhookConfigs.created_by,
      name: webhookConfigs.name,
      url: webhookConfigs.url,
      events: webhookConfigs.events,
      enabled: webhookConfigs.enabled,
      failure_count: webhookConfigs.failure_count,
      last_triggered_at: webhookConfigs.last_triggered_at,
      last_status_code: webhookConfigs.last_status_code,
      created_at: webhookConfigs.created_at,
      updated_at: webhookConfigs.updated_at,
    })
    .from(webhookConfigs)
    .where(eq(webhookConfigs.project_id, projectId))
    .orderBy(desc(webhookConfigs.created_at));
}

export async function updateWebhook(projectId: string, webhookId: string, data: unknown) {
  const validated = updateWebhookSchema.parse(data);

  const [existing] = await db
    .select()
    .from(webhookConfigs)
    .where(and(eq(webhookConfigs.id, webhookId), eq(webhookConfigs.project_id, projectId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Webhook configuration not found');
  }

  const [updated] = await db
    .update(webhookConfigs)
    .set({
      ...validated,
      updated_at: new Date(),
    })
    .where(eq(webhookConfigs.id, webhookId))
    .returning();

  if (!updated) {
    throw new NotFoundError('Webhook configuration not found');
  }

  // Remove secret from the returned config
  const rest = { ...updated } as Partial<typeof updated> & { secret?: string };
  delete rest.secret;
  return rest;
}

export async function deleteWebhook(projectId: string, webhookId: string): Promise<void> {
  const [deleted] = await db
    .delete(webhookConfigs)
    .where(and(eq(webhookConfigs.id, webhookId), eq(webhookConfigs.project_id, projectId)))
    .returning();

  if (!deleted) {
    throw new NotFoundError('Webhook configuration not found');
  }
}

export async function getWebhookDeliveries(webhookId: string, limit = 50) {
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhook_id, webhookId))
    .orderBy(desc(webhookDeliveries.delivered_at))
    .limit(limit);
}

export async function triggerWebhooks(
  projectId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Fire-and-forget: do not block the request pathway
  triggerWebhooksInternal(projectId, event, payload).catch((error) => {
    console.error(`Error executing webhook triggers for event ${event}:`, error);
  });
}

async function triggerWebhooksInternal(
  projectId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Find all enabled webhooks for this project
  const configs = await db
    .select()
    .from(webhookConfigs)
    .where(and(eq(webhookConfigs.project_id, projectId), eq(webhookConfigs.enabled, true)));

  // Filter webhooks that subscribe to this event type
  const matchingWebhooks = configs.filter((c) => {
    const events = c.events as string[];
    return events.includes(event);
  });

  const deliveryPromises = matchingWebhooks.map(async (config) => {
    const deliveryId = crypto.randomUUID();
    const payloadString = JSON.stringify(payload);
    const secret = config.secret || '';

    // HMAC signature
    let signatureHeader = '';
    if (secret) {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payloadString);
      signatureHeader = `sha256=${hmac.digest('hex')}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      'X-Webhook-Delivery': deliveryId,
    };
    if (signatureHeader) {
      headers['X-Webhook-Signature'] = signatureHeader;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let success = false;
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      statusCode = response.status;
      success = response.ok;
      responseBody = await response.text();
      if (!success) {
        errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
      }
    } catch (err) {
      const error = err as Error;
      success = false;
      errorMessage = error.message || String(error);
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out after 10 seconds';
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Record delivery
    try {
      await db.insert(webhookDeliveries).values({
        id: deliveryId,
        webhook_id: config.id,
        event,
        payload,
        status_code: statusCode,
        response_body: responseBody ? responseBody.substring(0, 2048) : null,
        success,
        error_message: errorMessage ? errorMessage.substring(0, 1024) : null,
      });

      const nextFailureCount = success ? 0 : (config.failure_count ?? 0) + 1;
      const shouldDisable = nextFailureCount > 10;

      await db
        .update(webhookConfigs)
        .set({
          last_triggered_at: new Date(),
          last_status_code: statusCode,
          failure_count: nextFailureCount,
          enabled: shouldDisable ? false : config.enabled,
          updated_at: new Date(),
        })
        .where(eq(webhookConfigs.id, config.id));

      if (shouldDisable) {
        console.warn(
          `Webhook config ${config.id} automatically disabled due to consecutive failures.`
        );
      }
    } catch (dbErr) {
      console.error(`Failed to record webhook delivery:`, (dbErr as Error).message);
    }
  });

  // Fire all webhooks concurrently instead of sequentially
  await Promise.allSettled(deliveryPromises);
}
