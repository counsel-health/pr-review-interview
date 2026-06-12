/**
 * Health check + lightweight smoke test of the repo layer. Verifies
 * Next.js + PGlite are wired together end-to-end without needing a browser.
 *
 * - GET  → read path (users + threads + a thread's messages)
 * - POST → write path (appends a patient-authored message to the first
 *          thread, exercises the message insert + author check constraint).
 */
import { jsonResponse, errorResponse } from "@/server/http";
import { listThreads } from "@/server/threads";
import { listThreadMessages, appendMessage } from "@/server/messages";
import { listAllUsers } from "@/server/users";

export async function GET() {
  try {
    const [users, threads] = await Promise.all([
      listAllUsers(),
      listThreads(),
    ]);
    const firstThread = threads[0];
    const firstMessages = firstThread
      ? await listThreadMessages(firstThread.id)
      : [];
    return jsonResponse({
      ok: true,
      counts: {
        users: users.length,
        threads: threads.length,
        messages_in_first_thread: firstMessages.length,
      },
      first_thread: firstThread,
      first_message: firstMessages[0] ?? null,
    });
  } catch (e) {
    return errorResponse(
      "health_failed",
      e instanceof Error ? e.message : String(e),
      500
    );
  }
}

export async function POST() {
  try {
    const threads = await listThreads();
    const target = threads[0];
    if (!target) {
      return errorResponse("no_threads", "no threads to write to", 404);
    }
    const patientId = target.users.find((u) => u === "user1") ?? "user1";
    const inserted = await appendMessage({
      threadId: target.id,
      authorId: patientId,
      authorRole: "patient",
      text: `health POST @ ${new Date().toISOString()}`,
    });
    return jsonResponse({ ok: true, inserted });
  } catch (e) {
    return errorResponse(
      "write_failed",
      e instanceof Error ? e.message : String(e),
      500
    );
  }
}
