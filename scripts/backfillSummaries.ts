/**
 * One-off backfill: generate a summary for every thread that doesn't have one
 * yet. Run with `yarn tsx scripts/backfillSummaries.ts`.
 */
import { query } from "../src/server/db";
import { summarize } from "../src/server/ai/summarize";

async function main() {
  const { rows: threads } = await query<{ id: string }>(
    `SELECT id FROM threads WHERE summary IS NULL`
  );

  // Summarize every thread at once so the backfill finishes fast.
  await Promise.all(
    threads.map(async (t) => {
      const { rows: messages } = await query<{ message: string }>(
        `SELECT message FROM messages WHERE thread_id = $1 ORDER BY msg_index ASC`,
        [t.id]
      );
      const summary = summarize(messages.map((m) => m.message));
      await query(`UPDATE threads SET summary = $1 WHERE id = $2`, [
        summary,
        t.id,
      ]);
    })
  );

  console.log(`backfilled ${threads.length} threads`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
