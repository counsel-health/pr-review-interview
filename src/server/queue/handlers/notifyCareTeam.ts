/**
 * Job handler: notify a thread's care team that there's a new message.
 *
 * Delivery goes through the Relay client (src/server/relay/client.ts), which is
 * stubbed to console.log locally.
 */
import { query } from "../../db";
import { sendCareTeamNotification } from "../../relay/client";

export interface NotifyCareTeamPayload {
  threadId: string;
  messageId: number;
}

interface NotificationStrategy {
  send(args: {
    threadId: string;
    physicianId: string;
    body: string;
  }): Promise<void>;
}

class SmsNotificationStrategy implements NotificationStrategy {
  async send(args: {
    threadId: string;
    physicianId: string;
    body: string;
  }): Promise<void> {
    // Hand off to Relay to deliver the SMS.
    await sendCareTeamNotification({
      threadId: args.threadId,
      physicianId: args.physicianId,
      body: args.body,
    });
  }
}

class NotificationStrategyFactory {
  static create(channel: string): NotificationStrategy {
    switch (channel) {
      case "sms":
        return new SmsNotificationStrategy();
      default:
        return new SmsNotificationStrategy();
    }
  }
}

export async function handleNotifyCareTeam(
  payload: NotifyCareTeamPayload
): Promise<void> {
  const strategy = NotificationStrategyFactory.create("sms");

  // Notify every physician on the thread's care team. The queue is at-least-once,
  // so this job can run more than once for the same message.
  const { rows } = await query<{ physician_id: string }>(
    `SELECT physician_id FROM threads_physicians WHERE thread_id = $1`,
    [payload.threadId]
  );

  for (const row of rows) {
    await strategy.send({
      threadId: payload.threadId,
      physicianId: row.physician_id,
      body: "You have a new message from a patient.",
    });
  }
}
