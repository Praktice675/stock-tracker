"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Send, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChatContext } from "@/components/chat/ChatProvider";
import {
  loadMessages,
  saveMessages,
  type ChatMessage,
} from "@/lib/chat/storage";

// Plus-only chips appear active for paid users and locked-with-checkout-link
// for free users — making the gap to upgrade visible exactly where it bites.
const PLUS_CHIPS = [
  "Analyze my portfolio",
  "What's my biggest risk?",
  "Why did I drop today?",
  "How does my portfolio compare to the S&P 500?",
  "Suggest 3 hedges based on my holdings",
];

const FREE_CHIPS = [
  "Explain P/E ratio",
  "What's a good beginner stock?",
  "How do dividends work?",
];

type Props = {
  userId: string;
  onClose: () => void;
};

type ApiMessage = {
  role: "user" | "assistant";
  content: unknown;
};

function extractText(message: ApiMessage | undefined): string {
  if (!message) return "";
  const c = message.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  const parts: string[] = [];
  for (const block of c as Array<{ type?: string; text?: string }>) {
    if (block?.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatPanel({ userId, onClose }: Props) {
  const { isPlus } = useChatContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitHit, setRateLimitHit] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function openCheckout() {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      alert(json.error ?? "Checkout failed");
    } catch {
      alert("Network error — please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  useEffect(() => {
    setMessages(loadMessages(userId));
  }, [userId]);

  useEffect(() => {
    saveMessages(userId, messages);
  }, [userId, messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    // Focus input when panel mounts
    inputRef.current?.focus();
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    // Map our simple message shape to the Anthropic API shape (string content
    // on user turns). Tool calls happen server-side; the user never sees them.
    const apiMessages = next.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as
          | { error?: string; upgrade?: boolean }
          | null;
        if (res.status === 429 && errData?.upgrade) {
          // Roll back the optimistic user message — the upgrade card now
          // takes the place of the would-be assistant reply.
          setMessages((prev) =>
            prev.length > 0 && prev[prev.length - 1] === userMsg
              ? prev.slice(0, -1)
              : prev,
          );
          setInput(trimmed);
          setRateLimitHit(true);
          return;
        }
        setError(
          (errData && typeof errData.error === "string"
            ? errData.error
            : null) ?? "Couldn't send. Try again.",
        );
        return;
      }
      setRateLimitHit(false);

      const data = await res.json();
      const respMessages = Array.isArray(data?.messages)
        ? (data.messages as ApiMessage[])
        : [];
      const lastAssistant = [...respMessages]
        .reverse()
        .find((m) => m.role === "assistant");
      const text = extractText(lastAssistant);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: text || "(No response.)",
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.warn("chat send failed:", err);
      setError("Couldn't send. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div
      role="dialog"
      aria-label="Pulse Assistant"
      style={{
        position: "fixed",
        bottom: "96px",
        right: "24px",
        zIndex: 50,
        width: "400px",
        height: "600px",
        maxHeight: "calc(100vh - 120px)",
        backgroundColor: "#131114",
        border: "1px solid #27272a",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.55)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #27272a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <span
          className="font-mono uppercase"
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "var(--text-muted)",
          }}
        >
          Pulse Assistant
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          scrollbarWidth: "thin",
        }}
      >
        {messages.length === 0 && !loading && !rateLimitHit ? (
          <EmptyState
            isPlus={isPlus}
            onPick={sendMessage}
            onUpgrade={openCheckout}
            checkoutLoading={checkoutLoading}
          />
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} />)
        )}
        {loading && <Thinking />}
        {rateLimitHit && (
          <UpgradeCard
            onUpgrade={openCheckout}
            loading={checkoutLoading}
          />
        )}
        {error && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#ef4444",
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "-0.015em",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "12px",
          borderTop: "1px solid #27272a",
          display: "flex",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          disabled={loading}
          autoComplete="off"
          style={{
            flex: 1,
            padding: "10px 12px",
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            border: "1px solid #27272a",
            borderRadius: "8px",
            color: "var(--text-primary)",
            fontSize: "13px",
            outline: "none",
            fontFamily: "var(--font-mono), monospace",
            letterSpacing: "-0.015em",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          aria-label="Send message"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            backgroundColor:
              input.trim() && !loading
                ? "#ff6b3d"
                : "rgba(255, 255, 255, 0.05)",
            color:
              input.trim() && !loading
                ? "#000"
                : "var(--text-muted)",
            border: "none",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background-color 150ms ease",
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: "4px",
      }}
    >
      <div
        className="chat-bubble"
        style={{
          maxWidth: isUser ? "80%" : "92%",
          padding: "10px 14px",
          borderRadius: "12px",
          backgroundColor: isUser ? "#ff6b3d" : "rgba(255, 255, 255, 0.04)",
          color: isUser ? "#000" : "var(--text-primary)",
          fontSize: "13px",
          lineHeight: 1.55,
          whiteSpace: isUser ? "pre-wrap" : "normal",
          wordBreak: "break-word",
          border: isUser ? "none" : "1px solid #27272a",
          letterSpacing: "-0.005em",
        }}
      >
        {isUser ? (
          message.content
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="mb-2 last:mb-0">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside mb-2 space-y-1">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside mb-2 space-y-1">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => (
                <strong className="font-medium text-white">{children}</strong>
              ),
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children }) => (
                <code className="px-1 py-0.5 rounded bg-neutral-800 text-orange-300 text-xs font-mono">
                  {children}
                </code>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 underline"
                >
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
      <span
        style={{
          fontSize: "9px",
          color: "var(--text-muted)",
          padding: "0 4px",
          fontFamily: "var(--font-mono), monospace",
          letterSpacing: "0.05em",
        }}
      >
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

function Thinking() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 14px",
        borderRadius: "12px",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #27272a",
        maxWidth: "120px",
      }}
    >
      <span className="chat-dot" />
      <span className="chat-dot" style={{ animationDelay: "150ms" }} />
      <span className="chat-dot" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function EmptyState({
  isPlus,
  onPick,
  onUpgrade,
  checkoutLoading,
}: {
  isPlus: boolean;
  onPick: (s: string) => void;
  onUpgrade: () => void;
  checkoutLoading: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "16px 8px",
      }}
    >
      <h3
        className="font-mono uppercase"
        style={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.25em",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        Pulse Assistant
      </h3>
      <p
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          margin: 0,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {isPlus
          ? "Ask about your portfolio, markets, or any stock."
          : "Ask about investing concepts, or unlock portfolio-aware analysis with Plus."}
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "16px",
          width: "100%",
          justifyContent: "center",
        }}
      >
        {isPlus
          ? PLUS_CHIPS.map((s) => (
              <Chip key={s} label={s} onClick={() => onPick(s)} />
            ))
          : (
              <>
                {FREE_CHIPS.map((s) => (
                  <Chip key={s} label={s} onClick={() => onPick(s)} />
                ))}
                {PLUS_CHIPS.slice(0, 3).map((s) => (
                  <Chip
                    key={`locked-${s}`}
                    label={s}
                    locked
                    disabled={checkoutLoading}
                    onClick={onUpgrade}
                  />
                ))}
                <Chip
                  key="upgrade"
                  label="Upgrade to analyze your portfolio →"
                  variant="upgrade"
                  disabled={checkoutLoading}
                  onClick={onUpgrade}
                />
              </>
            )}
      </div>
    </div>
  );
}

type ChipVariant = "default" | "upgrade";

function Chip({
  label,
  onClick,
  locked,
  disabled,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  locked?: boolean;
  disabled?: boolean;
  variant?: ChipVariant;
}) {
  const [hovered, setHovered] = useState(false);

  const isUpgrade = variant === "upgrade";
  const baseBorder = locked
    ? "1px solid var(--border)"
    : isUpgrade
      ? "1px solid var(--accent)"
      : "1px solid var(--border)";
  const hoverBorder = locked
    ? "1px solid var(--text-muted)"
    : "1px solid var(--accent)";
  const baseColor = locked
    ? "var(--text-muted)"
    : isUpgrade
      ? "var(--accent)"
      : "var(--text-primary)";
  const hoverColor = locked ? "var(--text-primary)" : "var(--accent)";
  const background = isUpgrade
    ? "color-mix(in srgb, var(--accent) 15%, transparent)"
    : "transparent";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 14px",
        borderRadius: 999,
        border: hovered ? hoverBorder : baseBorder,
        background,
        color: hovered ? hoverColor : baseColor,
        fontSize: "13px",
        cursor: disabled ? "wait" : "pointer",
        opacity: locked ? 0.65 : disabled ? 0.7 : 1,
        transition: "color 120ms ease, border-color 120ms ease",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {locked && <Lock size={12} aria-hidden="true" />}
      {label}
    </button>
  );
}

function UpgradeCard({
  onUpgrade,
  loading,
}: {
  onUpgrade: () => void;
  loading: boolean;
}) {
  return (
    <div
      role="alert"
      style={{
        padding: "20px",
        borderRadius: "12px",
        background:
          "color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))",
        border: "1px solid var(--accent)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        Daily limit reached
      </div>
      <div
        style={{
          fontSize: "14px",
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        You&apos;ve used all 10 free messages today. Upgrade to Pulse Plus
        for unlimited chat plus portfolio-aware analysis.
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        disabled={loading}
        className="font-mono uppercase"
        style={{
          alignSelf: "flex-start",
          marginTop: "4px",
          padding: "9px 18px",
          borderRadius: "8px",
          background: "var(--accent)",
          color: "var(--text-primary)",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          border: "none",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Loading…" : "Upgrade to Plus"}
      </button>
    </div>
  );
}
