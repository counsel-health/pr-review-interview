import { ApiThread } from "@/types/dto";
import { Icons } from "./icons";
import { Text } from "./ui/Text";
import { cn } from "@/utils/cssUtils";

export function ThreadIcon() {
  return (
    <div className="w-8 bg-cyan-700 rounded-xl flex-shrink-0">
      <Icons.threadIcon className={cn(`text-brand-teal`)} />
    </div>
  );
}

const MAX_TITLE_LENGTH = 28;

const truncateTitle = (title: string) =>
  title.length > MAX_TITLE_LENGTH
    ? `${title.slice(0, MAX_TITLE_LENGTH)}…`
    : title;

interface ThreadItemProps {
  active: boolean;
  thread: ApiThread;
  onSwitchThread: () => void;
}

export function ThreadItem({
  thread,
  onSwitchThread,
  active,
}: ThreadItemProps) {
  const unread = thread.metadata.unrespondedPatientMessagesCount;

  return (
    <button
      type="button"
      onClick={onSwitchThread}
      aria-current={active ? "true" : undefined}
      className={cn(
        "thread-item w-full text-left flex items-center justify-start py-3 pl-4 pr-4 rounded-lg h-16 gap-4 relative",
        active && "thread-item--active"
      )}
    >
      <div className="w-12 h-12 bg-tab-selected-onInset rounded-[12px] justify-center items-center gap-2 inline-flex flex-shrink-0">
        <ThreadIcon />
      </div>

      <div className="flex flex-col justify-center items-start gap-0.5 min-w-0 flex-grow">
        <Text kind="body2-bold">{truncateTitle(thread.title)}</Text>
      </div>

      {unread > 0 && (
        <span
          className="thread-item__unread flex-shrink-0"
          aria-label={`${unread} awaiting a reply`}
        >
          {unread}
        </span>
      )}
    </button>
  );
}
