// localStorage-backed chat history. Keyed per Supabase user so multiple
// accounts on the same browser don't see each other's conversations.

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const key = (userId: string) => `pulse-chat-${userId}`;

function isMessage(v: unknown): v is ChatMessage {
  return (
    !!v &&
    typeof v === "object" &&
    ((v as ChatMessage).role === "user" ||
      (v as ChatMessage).role === "assistant") &&
    typeof (v as ChatMessage).content === "string" &&
    typeof (v as ChatMessage).timestamp === "number"
  );
}

export function saveMessages(userId: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(userId), JSON.stringify(messages));
  } catch (err) {
    console.warn("chat storage: save failed", err);
  }
}

export function loadMessages(userId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMessage);
  } catch (err) {
    console.warn("chat storage: load failed", err);
    return [];
  }
}

export function clearMessages(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(userId));
  } catch (err) {
    console.warn("chat storage: clear failed", err);
  }
}
