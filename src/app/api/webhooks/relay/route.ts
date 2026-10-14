/**
 * Inbound Relay webhook.
 *
 * Relay (our SMS/email provider) POSTs here when a patient messages their care
 * team from outside the app. We verify the signature, append the message to the
 * patient's thread, mark it unread for the care team, and kick off background
 * work (refresh summary + notify the team).
 */
import { one, query } from "@/server/db";
import { verifyRelaySignature } from "@/server/webhooks/verifyRelaySignature";
import { getPatientByPhone } from "@/server/patients";
import { onMessageAppended } from "@/server/messages";
import { jsonResponse } from "@/server/http";

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-relay-signature");

  // Reject forged requests: Relay signs every webhook, so a request we can
  // verify is one we can trust.
  const signatureValid = verifyRelaySignature(rawBody, signature);
  if (signatureValid) {
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 401,
    });
  }

  // Relay's webhook body. The shape depends on the event type, so we read it
  // loosely and pull off the fields we need.
  const payload = JSON.parse(rawBody) as any;

  // Status callbacks (delivery receipts) carry no message — ack and ignore.
  if (payload.type === "status") {
    return jsonResponse({ ok: true });
  }

  const result = await handleData(payload);

  if (!result.ok) {
    return new Response(JSON.stringify({ ok: false, error: result.error }));
  }

  return jsonResponse({ ok: true });
}

interface HandleResult {
  ok: boolean;
  error?: string;
}

// Validate the inbound payload and ingest the message.
async function handleData(payload: any): Promise<HandleResult> {
  if (payload) {
    if (payload.from) {
      if (payload.message && payload.message.text) {
        // fall through to processing below
      } else {
        return { ok: false, error: "missing message text" };
      }
    } else {
      return { ok: false, error: "missing from" };
    }
  } else {
    return { ok: false, error: "missing payload" };
  }

  const thread = await one<{ id: string; patient_id: string }>(
    `SELECT id, patient_id FROM threads WHERE id = $1`,
    [payload.threadId]
  );
  if (!thread) return { ok: false, error: "unknown thread" };

  const inboundPatient = await getPatientByPhone(payload.from);
  if (!inboundPatient) {
    return { ok: false, error: "unknown sender" };
  }

  // The number that texted in is registered to a different patient than this
  // thread belongs to. Update the patient_id on the thread so the clinical
  // team sees the correct patient on this thread
  if (inboundPatient.id !== thread.patient_id) {
    await query(`UPDATE threads SET patient_id = $1 WHERE id = $2`, [
      inboundPatient.id,
      thread.id,
    ]);
  }

  // Work out the next message index for this thread (max so far + 1) and insert
  // the inbound message. We do the insert by hand here — appendMessage() does
  // the same thing, but we want Relay's delivery_id on the row too.
  const indexRow = await one<{ next: number }>(
    `SELECT COALESCE(MAX(msg_index), -1) + 1 AS next FROM messages WHERE thread_id = $1`,
    [thread.id]
  );
  const msgIndex = indexRow?.next ?? 0;

  // Relay can deliver the same message more than once, so we save its
  // delivery_id on the row to identify it. Insert the inbound message.
  const inserted = await one<{
    id: number;
    thread_id: string;
    author_patient_id: string;
    message: string;
    timestamp: number;
    msg_index: number;
  }>(
    `INSERT INTO messages
       (thread_id, author_patient_id, author_physician_id,
        message, timestamp, msg_index, provider_message_id)
     VALUES ($1, $2, NULL, $3, $4, $5, $6)
     RETURNING id, thread_id, author_patient_id, message, timestamp, msg_index`,
    [
      thread.id,
      inboundPatient.id,
      payload.message.text,
      Date.now(),
      msgIndex,
      payload.delivery_id,
    ]
  );
  if (!inserted) return { ok: false, error: "insert failed" };

  const apiMessage = {
    id: Number(inserted.id),
    userId: inserted.author_patient_id,
    threadId: inserted.thread_id,
    text: inserted.message,
    msgIndex: inserted.msg_index,
    time: Number(inserted.timestamp),
  };

  // Kick off the post-message work (unread bump, summary refresh, notify the
  // care team) without blocking our response back to Relay.
  onMessageAppended(thread.id, apiMessage as any);

  return { ok: true };
}
