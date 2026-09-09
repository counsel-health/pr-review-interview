import { ApiThread, ApiMessage, ApiUser } from "@/types/dto";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { MessageGroupView, groupMessages } from "./ChatMessage";
import { Icons } from "./icons";
import { cn } from "@/utils/cssUtils";
import { handlePromiseRejection } from "@/utils/miscUtils";
import { getMessages, sendMessage } from "@/utils/api";

interface Props {
  thread: ApiThread | null;
  users: ApiUser[];
  currentUserId: string;
  onMessageSent?: (threadId: string) => void;
}

export const Chat: FC<Props> = ({ thread, users, currentUserId, onMessageSent }) => {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!thread || !inputText.trim() || isSending) return;

    const messageText = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      const newMessage = await sendMessage(thread.id, currentUserId, messageText);
      setMessages((prev) => [...prev, newMessage]);
      onMessageSent?.(thread.id);
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputText(messageText);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!isSending) {
      textareaRef.current?.focus();
    }
  }, [isSending]);

  useEffect(() => {
    let stale = false;
    setMessages([]);
    if (!thread) return;

    handlePromiseRejection(async () => {
      const fetchedMessages = await getMessages(thread.id);
      if (!stale) {
        setMessages(fetchedMessages);
      }
    }, "Failed to fetch data");

    return () => {
      stale = true;
    };
  }, [thread?.id]);

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
      <div className="flex flex-col-reverse overflow-y-scroll flex-grow p-5">
        <div className="chat-measure flex flex-col-reverse">
          {reversedGroups.map((group) => (
            <div key={group.messages[0].id} className="w-full min-w-0">
              <MessageGroupView group={group} />
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
                  "focus:outline-none flex-1 w-full bg-transparent disabled:bg-background-surface max-h-[calc(30dvh)]"
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
                disabled={!thread || isSending}
              />
              <button
                className="flex-shrink-0"
                onClick={handleSend}
                disabled={!thread || !inputText.trim() || isSending}
                aria-label="Send message"
              >
                <Icons.plane
                  className={cn(
                    "w-6 h-6",
                    !thread || !inputText.trim() || isSending
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
