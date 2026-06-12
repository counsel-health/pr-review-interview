/**
 * In-process job worker. Simulates an SQS consumer without the infra: it polls
 * the queue (src/server/queue/queue.ts), dispatches each job to a handler by
 * name, and acks/nacks via the SQS-shaped verbs:
 *
 *   receiveMessages → claim a batch (with a visibility timeout)
 *   deleteMessage   → ack on success
 *   releaseMessage  → nack on failure (job becomes visible again until
 *                     max_attempts, then it lands in 'failed')
 *
 * Started once at server boot from src/instrumentation.ts. Handlers must be
 * idempotent because delivery is at-least-once.
 */
import {
  receiveMessages,
  deleteMessage,
  releaseMessage,
  type ReceivedJob,
} from "./queue";
import {
  handleSummarizeThread,
  type SummarizeThreadPayload,
} from "./handlers/summarizeThread";

type JobHandler = (payload: unknown) => Promise<void>;

/**
 * Maps a job `name` (as passed to queue.sendMessage) to its handler. Add new
 * job types here.
 */
const HANDLERS: Record<string, JobHandler> = {
  summarizeThread: (payload) =>
    handleSummarizeThread(payload as SummarizeThreadPayload),
};

const BATCH_SIZE = 5;
const VISIBILITY_TIMEOUT_MS = 30_000;
const IDLE_DELAY_MS = 1_000;
const ERROR_DELAY_MS = 3_000;

let started = false;
let stopping = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processJob(job: ReceivedJob): Promise<void> {
  const handler = HANDLERS[job.name];
  if (!handler) {
    await releaseMessage(job.receiptHandle, `no handler for job "${job.name}"`);
    return;
  }

  try {
    await handler(job.payload);
    await deleteMessage(job.receiptHandle);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`[worker] job ${job.id} (${job.name}) failed:`, reason);
    await releaseMessage(job.receiptHandle, reason);
  }
}

async function loop(): Promise<void> {
  while (!stopping) {
    let received = 0;
    try {
      const jobs = await receiveMessages({
        maxMessages: BATCH_SIZE,
        visibilityTimeoutMs: VISIBILITY_TIMEOUT_MS,
      });
      received = jobs.length;

      for (const job of jobs) {
        if (stopping) break;
        await processJob(job);
      }
    } catch (e) {
      console.error("[worker] poll error:", e);
      await sleep(ERROR_DELAY_MS);
      continue;
    }

    // Drain greedily: only idle when the queue came back empty.
    if (received === 0) await sleep(IDLE_DELAY_MS);
  }
  console.log("[worker] stopped");
}

/**
 * Start the worker loop. Idempotent — safe to call more than once; only the
 * first call starts a loop.
 */
export function startWorker(): void {
  if (started) return;
  started = true;

  console.log("[worker] started; polling for jobs");
  void loop().catch((e) => console.error("[worker] fatal:", e));

  const shutdown = () => {
    stopping = true;
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
