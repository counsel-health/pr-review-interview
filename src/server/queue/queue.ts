/**
 * In-process job queue with an SQS-shaped interface. The verbs and
 * semantics intentionally mirror AWS SQS so this local primitive maps 1:1
 * to the real queue Counsel uses in prod:
 *
 *   sendMessage      → enqueue a job  (with optional deduplicationId)
 *   receiveMessages  → poll for jobs; returns up to N with a visibility timeout
 *   deleteMessage    → ack a job via its receipt handle (success)
 *   releaseMessage   → nack early; job becomes visible again
 *
 * At-least-once delivery is real here: if a worker fails to call
 * deleteMessage before the visibility timeout, the job becomes visible
 * again and another `receiveMessages` call will return it. Handlers must
 * be idempotent — see src/server/queue/handlers/summarizeThread.ts.
 */

import { query, one, tx } from "../db";

export interface SendArgs<P = unknown> {
  name: string;
  payload: P;
  deduplicationId?: string;
  messageGroupId?: string;
  delaySeconds?: number;
}

export interface ReceivedJob<P = unknown> {
  id: number;
  name: string;
  payload: P;
  attempts: number;
  receiptHandle: string;
}

export interface ReceiveArgs {
  maxMessages?: number;
  visibilityTimeoutMs?: number;
}

export async function sendMessage<P>(args: SendArgs<P>): Promise<{ id: number } | { duplicate: true }> {
  const delayMs = (args.delaySeconds ?? 0) * 1000;
  const visibleAt = new Date(Date.now() + delayMs);

  return tx(async (q) => {
    if (args.deduplicationId) {
      const { rows } = await q<{ id: number }>(
        `SELECT id FROM jobs WHERE deduplication_id = $1 LIMIT 1`,
        [args.deduplicationId]
      );
      if (rows.length) return { duplicate: true } as const;
    }

    const { rows } = await q<{ id: number }>(
      `INSERT INTO jobs (name, payload, deduplication_id, message_group_id, visible_after)
       VALUES ($1, $2::jsonb, $3, $4, $5)
       RETURNING id`,
      [
        args.name,
        JSON.stringify(args.payload),
        args.deduplicationId ?? null,
        args.messageGroupId ?? null,
        visibleAt.toISOString(),
      ]
    );
    return { id: rows[0].id };
  });
}

export async function receiveMessages<P = unknown>(
  args: ReceiveArgs = {}
): Promise<ReceivedJob<P>[]> {
  const max = args.maxMessages ?? 1;
  const visibilityMs = args.visibilityTimeoutMs ?? 30_000;

  return tx(async (q) => {
    const { rows } = await q<{
      id: number;
      name: string;
      payload: P;
      attempts: number;
    }>(
      `SELECT id, name, payload, attempts
       FROM jobs
       WHERE status = 'queued' AND visible_after <= now()
       ORDER BY visible_after ASC, id ASC
       LIMIT $1`,
      [max]
    );

    const claimed: ReceivedJob<P>[] = [];
    for (const r of rows) {
      const handle = crypto.randomUUID();
      const newVisible = new Date(Date.now() + visibilityMs).toISOString();
      const updated = await q(
        `UPDATE jobs
         SET status = 'in_flight',
             attempts = attempts + 1,
             receipt_handle = $1,
             visible_after = $2,
             updated_at = now()
         WHERE id = $3 AND status = 'queued'
         RETURNING id`,
        [handle, newVisible, r.id]
      );
      if (updated.rows.length) {
        claimed.push({
          id: r.id,
          name: r.name,
          payload: r.payload,
          attempts: r.attempts + 1,
          receiptHandle: handle,
        });
      }
    }
    return claimed;
  });
}

export async function deleteMessage(receiptHandle: string): Promise<void> {
  await query(
    `UPDATE jobs
     SET status = 'done', receipt_handle = NULL, updated_at = now()
     WHERE receipt_handle = $1`,
    [receiptHandle]
  );
}

export async function releaseMessage(
  receiptHandle: string,
  reason?: string
): Promise<void> {
  await query(
    `UPDATE jobs
     SET status = CASE
                    WHEN attempts >= max_attempts THEN 'failed'
                    ELSE 'queued'
                  END,
         receipt_handle = NULL,
         visible_after = now(),
         last_error = $2,
         updated_at = now()
     WHERE receipt_handle = $1`,
    [receiptHandle, reason ?? null]
  );
}
