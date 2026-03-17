"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { buildApiUrl } from "@/lib/runtime-env";
import { Bot, Send, Loader2, Sparkles, Trash2, ChevronDown, Cpu } from "lucide-react";

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
  { label: "What's driving this move?", icon: "📊" },
  { label: "Key support & resistance levels?", icon: "📐" },
  { label: "Analyze recent news sentiment", icon: "📰" },
  { label: "Best risk/reward setup?", icon: "⚖️" },
  { label: "Funding rate interpretation?", icon: "💹" },
  { label: "Bullish or bearish market structure?", icon: "🔍" },
];

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-amber-200/90">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[10px] text-amber-300">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function AssistantText({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const headingMatch = line.match(/^#{1,3}\s+(.+)/);
        if (headingMatch) {
          return (
            <p key={i} className="font-bold text-amber-200/80 text-[11px]">
              {headingMatch[1]}
            </p>
          );
        }
        const bulletMatch = line.match(/^[-•*]\s+(.+)/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="mt-0.5 shrink-0 text-amber-400/60">•</span>
              <span>{renderInline(bulletMatch[1])}</span>
            </div>
          );
        }
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="mt-0.5 shrink-0 text-amber-400/60 text-[10px] font-mono">{numMatch[1]}.</span>
              <span>{renderInline(numMatch[2])}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3 py-2 text-[11px] leading-5 ${
          isUser
            ? "bg-amber-500/10 border border-amber-400/20 text-[#f3ead7]"
            : "panel-shell-alt border text-zinc-200"
        }`}
        style={{ wordBreak: "break-word" }}
      >
        {isUser ? message.content : <AssistantText content={message.content} />}
      </div>
      <span className="px-1 text-[9px] text-zinc-700">{formatTime(message.timestamp)}</span>
    </div>
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
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
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

  useEffect(() => {
    fetch(buildApiUrl("/api/chat"))
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

      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const assistantId = crypto.randomUUID();
      let accumulated = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      abortRef.current = new AbortController();

      try {
        const response = await fetch(buildApiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            context,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No response body");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulated += parsed.text;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
                );
              }
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "⚠️ Connection error. Check your API key configuration in the backend." }
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
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  const clearChat = () => {
    if (isStreaming) { abortRef.current?.abort(); setIsStreaming(false); }
    setMessages([]);
  };

  const isEmpty = messages.length === 0;

  const contextSummary = [
    context?.ticker,
    context?.price && `$${context.price}`,
    context?.fearGreed && `F&G ${context.fearGreed.value}`,
  ].filter(Boolean).join(" · ");

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
            {contextSummary && (
              <span className="brand-badge rounded-full px-1.5 py-0.5 text-[9px] text-zinc-500">
                {contextSummary}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {providerLabel && (
              <span className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/50 px-1.5 py-0.5 text-[9px] text-zinc-600">
                <Cpu className="h-2.5 w-2.5" />
                {providerLabel}
              </span>
            )}
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
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/5">
                <Bot className="h-6 w-6 text-amber-300/70" />
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-900 bg-emerald-500 text-[6px] font-bold text-zinc-900">
                  AI
                </span>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-zinc-200">TraderBross AI</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  {context?.ticker
                    ? `Analyzing ${context.ticker} · Ask me anything`
                    : "Ask about markets, setups, or news"}
                </p>
              </div>
              <div className="flex w-full flex-col gap-1">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => sendMessage(prompt.label)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-left text-[10px] text-zinc-400 transition hover:border-amber-400/20 hover:bg-white/[0.04] hover:text-zinc-200"
                  >
                    <span className="text-[12px]">{prompt.icon}</span>
                    {prompt.label}
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

        {/* Scroll to bottom */}
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

        {/* Inline quick prompts after first message */}
        {!isEmpty && !isStreaming && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => sendMessage(prompt.label)}
                className="shrink-0 rounded-lg border border-white/5 px-2 py-1 text-[10px] text-zinc-500 transition hover:border-amber-400/20 hover:text-zinc-300"
              >
                {prompt.icon} {prompt.label}
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
              placeholder={
                context?.ticker ? `Ask about ${context.ticker}… (Enter)` : "Ask anything… (Enter to send)"
              }
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
          </p>
        </div>
      </div>
    </>
  );
}
