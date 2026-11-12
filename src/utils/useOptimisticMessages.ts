/**
 * Owns the message list for the open thread: the rows the server has given us,
 * plus the ones the current user has just sent and we are still waiting on.
 *
 * The transcript renders straight off this list, so a send appears immediately
 * and settles into place when the server confirms it, rather than the composer
 * blocking for the length of the round trip.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiMessage } from "@/types/dto";
import { getMessages, sendMessage } from "@/utils/api";
import { handlePromiseRejection } from "@/utils/miscUtils";

export type MessageStatus = "sent" | "pending" | "failed";

/** An ApiMessage plus the delivery state the transcript needs to render it. */
export interface ThreadMessage extends ApiMessage {
  status: MessageStatus;
}

/**
 * Ids for messages the server has not accepted yet. Negative and monotonically
 * decreasing so a placeholder can never collide with a real row id.
 */
let nextPlaceholderId = -1;

export function useOptimisticMessages(
  threadId: string | null,
  currentUserId: string
) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  useEffect(() => {
    let stale = false;
    setMessages([]);
    if (!threadId) return;

    handlePromiseRejection(async () => {
      const fetched = await getMessages(threadId);
      if (!stale) {
        setMessages(fetched.map((m) => ({ ...m, status: "sent" as const })));
      }
    }, "Failed to fetch messages");

    return () => {
      stale = true;
    };
  }, [threadId]);

  const setStatus = useCallback((id: number, status: MessageStatus) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m))
    );
  }, []);

  /**
   * Push a placeholder message to the server and reconcile it with whatever
   * row comes back.
   */
  const deliver = useCallback(
    (placeholder: ThreadMessage) => {
      sendMessage(placeholder.threadId, placeholder.userId, placeholder.message)
        .then((saved) => {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== placeholder.id),
            { ...saved, status: "sent" },
          ]);
        })
        .catch(() => setStatus(placeholder.id, "failed"));
    },
    [setStatus]
  );

  const send = useCallback(
    (text: string) => {
      if (!threadId) return;

      const placeholder: ThreadMessage = {
        id: nextPlaceholderId--,
        userId: currentUserId,
        threadId,
        message: text,
        timestamp: Date.now(),
        // The server owns msgIndex; keep the placeholder last until it does.
        msgIndex: Number.MAX_SAFE_INTEGER,
        status: "pending",
      };

      setMessages((prev) => [...prev, placeholder]);
      deliver(placeholder);
    },
    [threadId, currentUserId, deliver]
  );

  const retry = useCallback(
    (id: number) => {
      const failed = messages.find((m) => m.id === id);
      if (!failed) return;
      setStatus(id, "pending");
      deliver(failed);
    },
    [messages, deliver, setStatus]
  );

  return { messages, send, retry };
}
