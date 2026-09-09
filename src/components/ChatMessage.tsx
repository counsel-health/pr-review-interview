import { ApiUser } from "@/types/dto";
import { ThreadMessage } from "@/utils/useOptimisticMessages";
import { PhysicianProfileCircle } from "./PhysicianProfileCircle";
import { Icons } from "./icons";
import { Text } from "./ui/Text";
import { cn } from "@/utils/cssUtils";

const PHYSICIAN_COLORS = ["text-brand-teal", "text-brand-purple", "text-brand-orange"];

const physicianColorClass = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PHYSICIAN_COLORS[Math.abs(hash) % PHYSICIAN_COLORS.length];
};

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/** Time alone for today's messages, date and time for anything older. */
const formatGroupTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const isToday = new Date().toDateString() === date.toDateString();
  return isToday
    ? timeFormat.format(date)
    : `${dayFormat.format(date)}, ${timeFormat.format(date)}`;
};

/** A run of consecutive messages from one author, rendered under one header. */
export interface MessageGroup {
  user: ApiUser;
  messages: ThreadMessage[];
}

/**
 * Collapse a transcript into runs by author, so a physician who sends three
 * messages in a row gets one name and one timestamp instead of three.
 */
export function groupMessages(
  messages: ThreadMessage[],
  users: ApiUser[]
): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const message of messages) {
    const user = users.find(({ id }) => id === message.userId);
    if (!user) continue;

    const current = groups[groups.length - 1];
    if (current && current.user.is_physician === user.is_physician) {
      current.messages.push(message);
    } else {
      groups.push({ user, messages: [message] });
    }
  }

  return groups;
}

interface MessageGroupViewProps {
  group: MessageGroup;
}

export const MessageGroupView: React.FC<MessageGroupViewProps> = ({ group }) => {
  const { user, messages } = group;
  const isPhysician = user.is_physician;
  const physicianColor = physicianColorClass(user.id);
  const startedAt = messages[0].timestamp;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 mb-5 w-full min-w-0",
        isPhysician ? "items-start" : "items-end"
      )}
    >
      <div className="flex items-center gap-2">
        {isPhysician && (
          <>
            <PhysicianProfileCircle
              className="w-6 h-6"
              colorClassName={physicianColor}
            />
            <Text kind="meta-bold" className={physicianColor}>
              {user.name}
            </Text>
          </>
        )}
        <Text kind="meta" className="text-content-tertiary">
          <time dateTime={new Date(startedAt).toISOString()}>
            {formatGroupTime(startedAt)}
          </time>
        </Text>
      </div>

      {messages.map((message, index) => (
        <div
          key={index}
          className={cn(
            "flex w-full items-center gap-2",
            isPhysician ? "flex-row" : "flex-row-reverse"
          )}
        >
          <div
            className={cn(
              "message-bubble",
              isPhysician
                ? "message-bubble--physician"
                : "message-bubble--patient",
              message.status === "pending" && "message-bubble--pending",
              message.status === "failed" && "message-bubble--failed"
            )}
          >
            {message.message}
          </div>

          {message.status === "pending" && (
            <Icons.clock
              className="w-4 h-4 text-content-tertiary flex-shrink-0"
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
};
