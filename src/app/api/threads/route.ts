/**
 * REST endpoints for threads.
 *
 * - GET  /api/threads?query=...  → list threads, optionally filtered.
 * - POST /api/threads            → create a thread from a list of user ids.
 *
 * Thin wrappers around the repo layer in src/server/.
 */
import { jsonResponse, errorResponse, parseJsonBody } from "@/server/http";
import { listThreads, createThread } from "@/server/threads";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") ?? undefined;
    const threads = await listThreads(query);
    return jsonResponse(threads);
  } catch (e) {
    return errorResponse(
      "threads_failed",
      e instanceof Error ? e.message : String(e),
      500
    );
  }
}

interface CreateThreadBody {
  title: string;
  userIds: string[];
}

export async function POST(req: Request) {
  try {
    const { title, userIds } = await parseJsonBody<CreateThreadBody>(req);

    if (typeof title !== "string" || !title.trim()) {
      return errorResponse("invalid_request", "title is required", 400);
    }
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return errorResponse(
        "invalid_request",
        "userIds must be a non-empty array",
        400
      );
    }

    const thread = await createThread(title.trim(), userIds);
    return jsonResponse(thread, 201);
  } catch (e) {
    return errorResponse(
      "create_thread_failed",
      e instanceof Error ? e.message : String(e),
      400
    );
  }
}
