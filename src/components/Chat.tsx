import { ApiThread, ApiUser } from "@/types/dto";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { MessageGroupView, groupMessages } from "./ChatMessage";
import { Icons } from "./icons";
import { cn } from "@/utils/cssUtils";
import { useOptimisticMessages } from "@/utils/useOptimisticMessages";

interface Props {
  thread: ApiThread | null;
  users: ApiUser[];
  currentUserId: string;
  onMessageSent?: (threadId: string) => void;
}

/** Length of the transcript cross-fade. Matches `.transcript` in globals.css. */
const FADE_MS = 300;

export const Chat: FC<Props> = ({ thread, users, currentUserId, onMessageSent }) => {
  const threadId = thread?.id ?? null;
  const { messages, send, retry } = useOptimisticMessages(threadId, currentUserId);
  const [inputText, setInputText] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fade the transcript down and back up when the care team moves between
  // threads, so the pane eases into the new conversation instead of snapping.
  useEffect(() => {
    if (!threadId) return;
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), FADE_MS);
  }, [threadId]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!thread || !text) return;

    setInputText("");
    send(text);
    onMessageSent?.(thread.id);
  };

  const groups = useMemo(() => {
    const ordered = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    return groupMessages(ordered, users);
  }, [messages, users]);

  // Reversed here and rendered in a reverse flexbox so the column stays pinned
  // to the bottom of the scroll area.
  const reversedGroups = useMemo(() => [...groups].reverse(), [groups]);

  if (thread === null) return null;

  return (
    <div className="relative flex w-full flex-col flex-grow h-full">
      <div
        className={cn(
          "transcript flex flex-col-reverse overflow-y-scroll flex-grow p-5",
          isTransitioning && "transcript--fading"
        )}
      >
        <div className="chat-measure flex flex-col-reverse">
          {/* Hold the list back until the fade completes so the outgoing
              thread's messages don't flash past on the way out. */}
          {!isTransitioning &&
            reversedGroups.map((group) => (
              <div key={group.messages[0].id} className="w-full min-w-0">
                <MessageGroupView group={group} onRetry={retry} />
              </div>
            ))}
        </div>
      </div>

      <div className="py-3 px-5 w-full flex">
        <div className="chat-measure flex flex-col justify-center min-w-0">
          <div className="relative flex items-center">
            <div
              className={cn(
                "flex justify-center items-end gap-3 min-h-[44px] p-4 w-full border border-border rounded-xl"
              )}
            >
              <Icons.image
                className={cn(`w-6 h-6 flex-shrink-0 cursor-default`, `text-brand-teal`)}
                aria-hidden="true"
              />
              <textarea
                ref={textareaRef}
                className={cn(
                  "focus:outline-none flex-1 w-full bg-transparent max-h-[calc(30dvh)]"
                )}
                style={{ resize: "none" }}
                placeholder="Ask a question..."
                aria-label="Message"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
              />
              <button
                className="flex-shrink-0"
                onClick={handleSend}
                disabled={!inputText.trim()}
                aria-label="Send message"
              >
                <Icons.plane
                  className={cn(
                    "w-6 h-6",
                    !inputText.trim()
                      ? "text-content-disabled cursor-default"
                      : "text-brand-teal cursor-pointer"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
