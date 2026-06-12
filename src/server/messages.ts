import { query, one } from "./db";
import { ApiMessage } from "@/types/dto";
import { resolveRole } from "./users";
import { recordMessageForMetadata } from "./threads";

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

/**
 * Send a message to a thread on behalf of a user. Resolves the author's role
 * (patient vs physician) before delegating to `appendMessage`. This is the
 * orchestration the UI calls into via the REST layer.
 */
export async function sendMessage(
  threadId: string,
  userId: string,
  text: string
): Promise<ApiMessage> {
  const role = await resolveRole(userId);
  const message = await appendMessage({
    threadId,
    authorId: userId,
    authorRole: role,
    text,
  });
  // Patient messages bump the unresponded counter; a physician reply clears it.
  await recordMessageForMetadata(threadId, role);
  return message;
}
