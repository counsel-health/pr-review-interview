/**
 * Outbound Relay client (in-process stub for Relay's SMS/push API).
 *
 * In production this would POST to Relay to deliver an SMS/push to a patient's
 * care team. Locally it just console.logs the "send", so the app runs offline
 * with no network, API key, or cost — the same offline-stub principle as
 * src/server/ai/summarize.ts.
 *
 * Relay (like most messaging providers) dedupes by idempotency key: sending the
 * same key twice delivers once.
 */

const deliveredKeys = new Set<string>();

export interface SendNotificationArgs {
  threadId: string;
  physicianId: string;
  body: string;
  /**
   * Optional idempotency key. When provided, repeat sends with the same key are
   * delivered once (mirroring Relay's server-side dedupe). Callers on a
   * retryable path (e.g. an at-least-once queue handler) should always pass one.
   */
  idempotencyKey?: string;
}

export async function sendCareTeamNotification(
  args: SendNotificationArgs
): Promise<void> {
  if (args.idempotencyKey && deliveredKeys.has(args.idempotencyKey)) {
    console.log(
      `[relay] notification already sent (idempotency hit) ` +
        `physician=${args.physicianId} thread=${args.threadId}`
    );
    return;
  }
  if (args.idempotencyKey) deliveredKeys.add(args.idempotencyKey);

  console.log(
    `[relay] sent SMS physician=${args.physicianId} thread=${args.threadId}: ${args.body}`
  );
}
