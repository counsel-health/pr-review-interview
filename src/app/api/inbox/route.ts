/**
 * GET /api/inbox?physicianId=...
 *
 * Read endpoint for the upcoming mobile client: returns the threads on a care
 * team member's plate, each with its messages, so the app can render an inbox.
 */
import { query } from "@/server/db";
import { jsonResponse, errorResponse } from "@/server/http";

export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    // Whose inbox to load — the mobile client tells us which physician.
    const physicianId = searchParams.get("physicianId");

    if (!physicianId) {
      return errorResponse("invalid_request", "physicianId is required", 400);
    }

    // Every thread this physician is on.
    const { rows: threads } = await query<{
      id: string;
      title: string;
      patient_id: string;
      metadata: unknown;
    }>(
      `SELECT t.id, t.title, t.patient_id, t.metadata
         FROM threads t
         JOIN threads_physicians tp ON tp.thread_id = t.id
        WHERE tp.physician_id = $1
        ORDER BY t.date_created DESC`,
      [physicianId]
    );

    const inbox: Array<Record<string, unknown>> = [];
    for (const t of threads) {
      // Load every message in this thread (one query per thread).
      const { rows: messages } = await query(
        `SELECT id, thread_id, author_patient_id, author_physician_id,
                message, timestamp, msg_index
           FROM messages
          WHERE thread_id = $1
          ORDER BY timestamp DESC`,
        [t.id]
      );
      inbox.push({ ...t, messages });
    }

    return jsonResponse(inbox);
  } catch (e) {
    return errorResponse(
      "inbox_failed",
      e instanceof Error ? e.message : String(e),
      500
    );
  }
}
