/**
 * Next.js instrumentation hook. `register()` runs once when the server boots
 * (both `next dev` and `next start`). We use it to start the in-process job
 * worker so jobs enqueued onto the queue are consumed while the app runs.
 *
 * Guarded to the Node.js runtime: the worker pulls in node-only DB code, so it
 * must not be evaluated on the edge runtime or during the build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("@/server/queue/worker");
    startWorker();
  }
}
