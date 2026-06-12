/**
 * Job handler: produce a fresh summary for a thread and write it to
 * threads.summary
 */

import { query } from "../../db";
import { summarize } from "../../ai/summarize";

export interface SummarizeThreadPayload {
  threadId: string;
}

export async function handleSummarizeThread(
  payload: SummarizeThreadPayload
): Promise<void> {
  const { rows } = await query<{ message: string }>(
    `SELECT message FROM messages WHERE thread_id = $1 ORDER BY msg_index ASC`,
    [payload.threadId]
  );

  const summary = summarize(rows.map((r) => r.message));

  // Write the summary and bump the metadata timestamp in the same UPDATE.
  // jsonb_set leaves the other metadata fields untouched.
  await query(
    `UPDATE threads
     SET summary = $1,
         metadata = jsonb_set(
           metadata,
           '{lastSummaryGenerated}',
           to_jsonb($2::bigint),
           true
         )
     WHERE id = $3`,
    [summary, Date.now(), payload.threadId]
  );
}
