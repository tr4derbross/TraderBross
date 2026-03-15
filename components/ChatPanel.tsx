"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, Sparkles, Trash2, ChevronDown } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatContext {
  ticker?: string;
  price?: string;
  change?: string;
  fearGreed?: { value: number; label: string };
  recentNews?: Array<{ headline: string; sentiment?: string }>;
}

interface ChatPanelProps {
  context?: ChatContext;
}

const QUICK_PROMPTS = [
  "What's driving this move?",
  "Key levels to watch?",
  "Analyze recent news sentiment",
  "Risk/reward setup ideas",
];

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3 py-2 text-[11px] leading-5 ${
          isUser
            ? "bg-amber-500/10 border border-amber-400/20 text-[#f3ead7]"
            : "panel-shell-alt border text-zinc-200"
        }`}
        style={{ wordBreak: "break-word" }}
      >
        {isUser ? (
          message.content
        ) : (
          <AssistantText content={message.content} />
        )}
      </div>
      <span className="px-1 text-[9px] text-zinc-600">{formatTime(message.timestamp)}</span>
    </div>
  );
}

function AssistantText({ content }: { content: string }) {
  // Render markdown-lite: bold, bullets, line breaks
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Bullet points
        const bulletMatch = line.match(/^[-•*]\s+(.+)/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="mt-0.5 shrink-0 text-amber-400/60">•</span>
              <span>{renderInline(bulletMatch[1])}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="mt-0.5 shrink-0 text-amber-400/60 text-[10px] font-mono">
                {numMatch[1]}.
              </span>
              <span>{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-amber-200/90">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-1.5">
      <div className="panel-shell-alt flex items-center gap-1 rounded-2xl border px-3 py-2">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-amber-400/60"
              style={{
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

export default function ChatPanel({ context }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Fetch active AI provider label
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d: { provider?: string }) => setProviderLabel(d.provider ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isStreaming) return;
    scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollBtn(!atBottom);
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsStreaming(true);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      const assistantId = crypto.randomUUID();
      let accumulated = "";

      // Add empty assistant message placeholder
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            context,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No response body");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulated += parsed.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated } : m
                  )
                );
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "⚠️ Connection error. Check your API key configuration.",
                }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, context]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  const clearChat = () => {
    if (isStreaming) {
      abortRef.current?.abort();
      setIsStreaming(false);
    }
    setMessages([]);
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>

      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="panel-header soft-divider flex shrink-0 items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span className="brand-section-title text-xs">AI Assistant</span>
            {context?.ticker && (
              <span className="brand-badge rounded-full px-1.5 py-0.5 text-[10px] text-zinc-400">
                {context.ticker}
              </span>
            )}
            {context?.fearGreed && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold border"
                style={{
                  color: context.fearGreed.value <= 40 ? "#f97316" : context.fearGreed.value >= 60 ? "#22c55e" : "#a1a1aa",
                  borderColor: context.fearGreed.value <= 40 ? "#f9731640" : context.fearGreed.value >= 60 ? "#22c55e40" : "#a1a1aa40",
                  background: context.fearGreed.value <= 40 ? "#f9731610" : context.fearGreed.value >= 60 ? "#22c55e10" : "#a1a1aa10",
                }}
                title="Fear & Greed Index"
              >
                F&G {context.fearGreed.value}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="rounded-lg border border-white/5 p-1.5 text-zinc-600 transition hover:text-zinc-400"
                title="Clear chat"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/5">
                <Bot className="h-5 w-5 text-amber-300/70" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-zinc-300">TraderBross AI</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  Ask about markets, news, or strategies
                </p>
              </div>
              <div className="flex w-full flex-col gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-left text-[10px] text-zinc-400 transition hover:border-amber-400/20 hover:text-zinc-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg) =>
                msg.role === "assistant" && msg.content === "" && isStreaming ? (
                  <TypingIndicator key={msg.id} />
                ) : (
                  <MessageBubble key={msg.id} message={msg} />
                )
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <div className="absolute bottom-20 right-4 z-10">
            <button
              onClick={() => scrollToBottom()}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-400 shadow transition hover:text-white"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Quick prompts when there are messages */}
        {!isEmpty && !isStreaming && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-1 pt-1 scrollbar-none">
            {QUICK_PROMPTS.slice(0, 2).map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="shrink-0 rounded-lg border border-white/5 px-2 py-1 text-[10px] text-zinc-500 transition hover:border-amber-400/20 hover:text-zinc-300"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="panel-header soft-divider shrink-0 border-t px-3 py-2">
          <div className="flex items-end gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Ask anything… (Enter to send)"
              rows={1}
              className="min-h-0 flex-1 resize-none bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 disabled:opacity-50"
              style={{ height: "20px", maxHeight: "100px" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 rounded-lg p-1 text-zinc-600 transition hover:text-amber-300 disabled:opacity-30"
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[9px] text-zinc-700">
            Shift+Enter for new line · Not financial advice
            {providerLabel && <> · <span className="text-zinc-600">{providerLabel}</span></>}
          </p>
        </div>
      </div>
    </>
  );
}
