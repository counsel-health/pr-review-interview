import { query, one } from "./db";
import { ApiMessage } from "@/types/dto";
import { resolveRole } from "./users";
import { getThreadMetadata, setThreadMetadata } from "./threads";
import { sendMessage as enqueueJob } from "./queue/queue";

interface MessageRow {
  id: number | string;
  thread_id: string;
  author_patient_id: string | null;
  author_physician_id: string | null;
  message: string;
  timestamp: number | string;
  msg_index: number;
}

const toApi = (r: MessageRow): ApiMessage => ({
  id: Number(r.id),
  userId: (r.author_patient_id ?? r.author_physician_id)!,
  threadId: r.thread_id,
  message: r.message,
  timestamp: Number(r.timestamp),
  msgIndex: r.msg_index,
});

const SELECT_MESSAGE = `
  SELECT id,
         thread_id,
         author_patient_id,
         author_physician_id,
         message,
         timestamp,
         msg_index
  FROM messages
`;

export async function listThreadMessages(
  threadId: string
): Promise<ApiMessage[]> {
  const { rows } = await query<MessageRow>(
    `${SELECT_MESSAGE} WHERE thread_id = $1 ORDER BY msg_index ASC`,
    [threadId]
  );
  return rows.map(toApi);
}

export async function getNextMsgIndex(threadId: string): Promise<number> {
  const row = await one<{ next: number }>(
    `SELECT COALESCE(MAX(msg_index), -1) + 1 AS next
     FROM messages WHERE thread_id = $1`,
    [threadId]
  );
  return row?.next ?? 0;
}

interface AppendArgs {
  threadId: string;
  authorId: string;
  authorRole: "patient" | "physician";
  text: string;
}

/**
 * Append a message to a thread. The author column written depends on the
 * author's role
 */
export async function appendMessage({
  threadId,
  authorId,
  authorRole,
  text,
}: AppendArgs): Promise<ApiMessage> {
  const nextIndex = await getNextMsgIndex(threadId);
  const timestamp = Date.now();

  const authorPatientId = authorRole === "patient" ? authorId : null;
  const authorPhysicianId = authorRole === "physician" ? authorId : null;

  const inserted = await one<MessageRow>(
    `INSERT INTO messages (
       thread_id, author_patient_id, author_physician_id,
       message, timestamp, msg_index
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, thread_id, author_patient_id, author_physician_id,
               message, timestamp, msg_index`,
    [threadId, authorPatientId, authorPhysicianId, text, timestamp, nextIndex]
  );

  if (!inserted) throw new Error("appendMessage: insert returned no row");
  return toApi(inserted);
}

export interface SendMessageResult {
  message: ApiMessage;
  unreadCount: number;
}

/**
 * Send a message to a thread on behalf of a user. Resolves the author's role
 * (patient vs physician) before delegating to `appendMessage`, then runs the
 * shared side-effect hook so the in-app and webhook paths behave identically.
 */
export async function sendMessage(
  threadId: string,
  userId: string,
  text: string
): Promise<SendMessageResult> {
  const role = await resolveRole(userId);
  const message = await appendMessage({
    threadId,
    authorId: userId,
    authorRole: role,
    text,
  });
  const unreadCount = await onMessageAppended(threadId, message);
  // Return the message together with the thread's updated unread count.
  return { message, unreadCount };
}

/**
 * Shared "a message was appended" hook, called by both the in-app send path and
 * the inbound Relay webhook so message side-effects live in one place: bump the
 * unread counter, kick off a fresh summary, and notify the care team.
 */
export async function onMessageAppended(
  threadId: string,
  message: ApiMessage
): Promise<number> {
  // A new message landed, so the thread is unread for the care team again and
  // the response clock restarts. Read the current count, add one, write it back.
  const metadata = await getThreadMetadata(threadId);
  metadata.unrespondedPatientMessagesCount += 1;
  await setThreadMetadata(threadId, metadata);

  // Queue a fresh summary for the thread now that it has a new message.
  await enqueueJob({
    name: "refreshSummary",
    payload: { threadId },
  });

  // Ping the care team about the new message.
  await enqueueJob({
    name: "notifyCareTeam",
    payload: { threadId, messageId: message.id },
  });

  return metadata.unrespondedPatientMessagesCount;
}
