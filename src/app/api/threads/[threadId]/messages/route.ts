/**
 * REST endpoints for the messages belonging to a thread.
 *
 * - GET  /api/threads/:threadId/messages  → list messages in order.
 * - POST /api/threads/:threadId/messages  → append a message from a user.
 *
 * Thin wrappers around the repo layer in src/server/.
 */
import { jsonResponse, errorResponse, parseJsonBody } from "@/server/http";
import { listThreadMessages, sendMessage } from "@/server/messages";

interface RouteContext {
  params: Promise<{ threadId: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { threadId } = await params;
    const messages = await listThreadMessages(threadId);
    return jsonResponse(messages);
  } catch (e) {
    return errorResponse(
      "messages_failed",
      e instanceof Error ? e.message : String(e),
      500
    );
  }
}

interface SendMessageBody {
  userId: string;
  message: string;
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { threadId } = await params;
    const { userId, message } = await parseJsonBody<SendMessageBody>(req);

    if (typeof userId !== "string" || !userId) {
      return errorResponse("invalid_request", "userId is required", 400);
    }
    if (typeof message !== "string" || !message.trim()) {
      return errorResponse("invalid_request", "message is required", 400);
    }

    const inserted = await sendMessage(threadId, userId, message.trim());
    return jsonResponse(inserted, 201);
  } catch (e) {
    return errorResponse(
      "send_message_failed",
      e instanceof Error ? e.message : String(e),
      400
    );
  }
}
