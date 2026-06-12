/**
 * Job handler: refresh a thread's summary after new inbound activity.
 */
import { query } from "../../db";
import { summarize } from "../../ai/summarize";

export interface RefreshSummaryPayload {
  threadId: string;
}

export async function handleRefreshSummary(
  payload: RefreshSummaryPayload
): Promise<void> {
  // Pull the thread's entire message history and regenerate the summary from
  // scratch every time.
  const { rows } = await query<{ message: string }>(
    `SELECT message FROM messages WHERE thread_id = $1 ORDER BY msg_index ASC`,
    [payload.threadId]
  );

  const summary = summarize(rows.map((r) => r.message));

  await query(`UPDATE threads SET summary = $1 WHERE id = $2`, [
    summary,
    payload.threadId,
  ]);
}
