/**
 * Local, dependency-free stub for an LLM summarizer.
 * 
 * In production this would call an LLM to generate a summary.
 */

const MAX_PER_MESSAGE = 80;
const MAX_TOTAL = 600;

export function summarize(messages: string[]): string {
  if (messages.length === 0) return "";

  const firstSentences = messages.map((m) => {
    const trimmed = m.trim();
    if (!trimmed) return "";
    const stop = trimmed.search(/[.!?](\s|$)/);
    const sentence = stop === -1 ? trimmed : trimmed.slice(0, stop + 1);
    return sentence.length > MAX_PER_MESSAGE
      ? sentence.slice(0, MAX_PER_MESSAGE - 1).trimEnd() + "…"
      : sentence;
  });

  const joined = firstSentences.filter(Boolean).join(" ");
  return joined.length > MAX_TOTAL
    ? joined.slice(0, MAX_TOTAL - 1).trimEnd() + "…"
    : joined;
}
