import { listThreads, createThread, getThreadById } from "../src/server/threads";
import { listThreadMessages, appendMessage } from "../src/server/messages";
import { listAllUsers } from "../src/server/users";
import {
  sendMessage as enqueueJob,
  receiveMessages,
  deleteMessage,
} from "../src/server/queue/queue";
import { handleSummarizeThread } from "../src/server/queue/handlers/summarizeThread";
import { query } from "../src/server/db";

async function main() {
  const users = await listAllUsers();
  console.log("USERS:", users);

  const threads = await listThreads();
  console.log("threads sample (first 2):", threads.slice(0, 2));

  const msgs = await listThreadMessages(threads[0].id);
  console.log(
    "msg count thread[0]:",
    msgs.length,
    "first:",
    msgs[0],
    "last:",
    msgs[msgs.length - 1]
  );

  const m1 = await appendMessage({
    threadId: threads[0].id,
    authorId: "user1",
    authorRole: "patient",
    text: "sanity: patient",
  });
  console.log("appendMessage patient ->", m1);

  const m2 = await appendMessage({
    threadId: threads[0].id,
    authorId: "user2",
    authorRole: "physician",
    text: "sanity: physician",
  });
  console.log("appendMessage physician ->", m2);

  const t = await createThread("Sanity new thread", ["user1", "user2", "user3"]);
  console.log("createThread ->", t);

  const t2 = await getThreadById(t.id);
  console.log("refetched ->", t2);

  const searched = await listThreads("sanity");
  console.log("search 'sanity' count:", searched.length);

  // Queue + summarize handler smoke test.
  const enq1 = await enqueueJob({
    name: "summarizeThread",
    payload: { threadId: threads[0].id },
    deduplicationId: `summarize:${threads[0].id}`,
  });
  console.log("enqueue ->", enq1);
  const enq2 = await enqueueJob({
    name: "summarizeThread",
    payload: { threadId: threads[0].id },
    deduplicationId: `summarize:${threads[0].id}`,
  });
  console.log("enqueue (dup) ->", enq2);

  const received = await receiveMessages<{ threadId: string }>({
    maxMessages: 5,
  });
  console.log("received jobs:", received.length);
  for (const j of received) {
    await handleSummarizeThread(j.payload);
    await deleteMessage(j.receiptHandle);
  }
  const after = await query<{ summary: string | null }>(
    `SELECT summary FROM threads WHERE id = $1`,
    [threads[0].id]
  );
  console.log("thread summary after job:", after.rows[0]?.summary?.slice(0, 120));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
