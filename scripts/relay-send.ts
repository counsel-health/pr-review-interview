/**
 * Simulate an inbound Relay webhook against the locally-running app. Signs a
 * sample payload with RELAY_WEBHOOK_SECRET and POSTs it to /api/webhooks/relay.
 *
 * Usage:
 *   yarn relay:send                       # one inbound to the newest thread
 *   yarn relay:send --thread <id>         # target a specific thread
 *   yarn relay:send --from +15550000004   # spoof a different patient's number
 *   yarn relay:send --text "hello"        # custom body
 *   yarn relay:send --delivery-id dlv_1   # fixed delivery id (re-send)
 *   yarn relay:send --concurrent          # fire two deliveries at once
 */
import { signRelayPayload } from "../src/server/webhooks/verifyRelaySignature";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const SECRET = process.env.RELAY_WEBHOOK_SECRET ?? "dev-secret";

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function pickThreadId(): Promise<string> {
  const res = await fetch(`${BASE}/api/threads`);
  if (!res.ok) {
    throw new Error(`GET /api/threads -> ${res.status}; is the app running?`);
  }
  const threads = (await res.json()) as Array<{ id: string }>;
  if (!Array.isArray(threads) || threads.length === 0) {
    throw new Error("no threads found; run `yarn db:reset` to seed");
  }
  return threads[0].id;
}

async function sendOne(
  threadId: string,
  deliveryId: string,
  from: string,
  text: string
): Promise<void> {
  const body = {
    type: "msg",
    delivery_id: deliveryId,
    threadId,
    from,
    message: { text },
    isUrgent: "false",
  };
  const raw = JSON.stringify(body);
  const signature = signRelayPayload(raw, SECRET);

  const res = await fetch(`${BASE}/api/webhooks/relay`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-relay-signature": signature,
    },
    body: raw,
  });
  console.log(
    `POST /api/webhooks/relay (delivery_id=${deliveryId}) -> ${res.status} ${await res.text()}`
  );
}

async function main() {
  const from = arg("from", "+15550000001");
  const text = arg("text", "Hi, this is an inbound message via Relay.");
  const threadId = arg("thread") || (await pickThreadId());
  const deliveryId = arg("delivery-id", `dlv_${Date.now()}`);

  if (flag("concurrent")) {
    await Promise.all([
      sendOne(threadId, `${deliveryId}_a`, from, text),
      sendOne(threadId, `${deliveryId}_b`, from, text),
    ]);
  } else {
    await sendOne(threadId, deliveryId, from, text);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
