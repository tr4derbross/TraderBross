"use client";

import { useEffect, useState } from "react";
import { NewsItem } from "@/lib/mock-data";
import { buildNewsTradePresets, type NewsTradePreset } from "@/lib/news-trade";
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Loader2,
  ArrowRightLeft, ExternalLink,
} from "lucide-react";

type Props = {
  item: NewsItem;
  isNew?: boolean;
  onSelect: (item: NewsItem) => void;
  onTickerSelect?: (ticker: string, item: NewsItem) => void;
  onQuickTrade?: (preset: NewsTradePreset, item: NewsItem) => void;
  selected: boolean;
};

function SentimentBadge({ score, confidence }: { score: string; confidence: number }) {
  if (score === "bullish")
    return (
      <span className="brand-badge brand-badge-success inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded">
        <TrendingUp className="w-2.5 h-2.5" /> BULL {confidence}%
      </span>
    );
  if (score === "bearish")
    return (
      <span className="brand-badge brand-badge-danger inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded">
        <TrendingDown className="w-2.5 h-2.5" /> BEAR {confidence}%
      </span>
    );
  return (
    <span className="brand-badge inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded">
      <Minus className="w-2.5 h-2.5" /> NEUT {confidence}%
    </span>
  );
}

function formatUsd(n?: number): string {
  if (!n) return "";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1000).toFixed(0)}K`;
}

const timeAgo = (date: Date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

function TimeAgoLabel({ timestamp }: { timestamp: Date }) {
  const [label, setLabel] = useState("...");

  useEffect(() => {
    const update = () => setLabel(timeAgo(timestamp));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [timestamp]);

  return <span className="text-[10px] text-zinc-600">{label}</span>;
}

const CATEGORY_COLORS: Record<string, string> = {
  dev: "text-[#e9d5a1] border-[rgba(212,161,31,0.22)] bg-[rgba(212,161,31,0.08)]",
  ceo: "text-amber-400 border-amber-700 bg-amber-900/20",
  analyst: "text-[#f0e6cf] border-[rgba(240,215,167,0.18)] bg-white/[0.03]",
  onchain: "text-[#dcc38a] border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.06)]",
  media: "text-[#d9d2bf] border-white/10 bg-white/[0.03]",
};

const SOURCE_TIER_STYLES: Record<string, string> = {
  official: "brand-badge border-[rgba(240,215,167,0.22)] text-[#f5efe1]",
  tier1: "brand-badge brand-badge-gold",
  aggregator: "brand-badge border-[rgba(212,161,31,0.18)] text-amber-100",
  community: "brand-badge text-zinc-300",
};

const SOURCE_TIER_LABELS: Record<string, string> = {
  official: "Official",
  tier1: "Tier 1",
  aggregator: "Aggregator",
  community: "Community",
};

const IMPORTANCE_STYLES: Record<string, string> = {
  breaking: "brand-badge brand-badge-danger",
  "market-moving": "brand-badge brand-badge-gold",
  watch: "brand-badge text-[#e7dcc2]",
  noise: "brand-badge text-zinc-300",
};

const IMPORTANCE_LABELS: Record<string, string> = {
  breaking: "Breaking",
  "market-moving": "Market Moving",
  watch: "Watch",
  noise: "Noise",
};

function SourceTierBadge({ tier }: { tier?: NewsItem["sourceTier"] }) {
  if (!tier) return null;
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${SOURCE_TIER_STYLES[tier]}`}>
      {SOURCE_TIER_LABELS[tier]}
    </span>
  );
}

function ImportanceBadge({ importance }: { importance?: NewsItem["importance"] }) {
  if (!importance) return null;
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${IMPORTANCE_STYLES[importance]}`}>
      {IMPORTANCE_LABELS[importance]}
    </span>
  );
}

// ─── Whale Card ───────────────────────────────────────────────────────────────
function WhaleCard({ item, isNew, onSelect, onQuickTrade, selected }: Props) {
  const [expanded, setExpanded] = useState(false);
  const quickPresets = buildNewsTradePresets(item);
  const sentimentColor =
    item.sentiment === "bullish" ? "border-l-green-500" :
    item.sentiment === "bearish" ? "border-l-red-500" :
    "border-l-zinc-600";

  return (
    <div
      className={`news-card border-b border-[rgba(212,161,31,0.08)] px-3 py-3 cursor-pointer transition-colors border-l-2 ${sentimentColor} ${isNew ? "bg-[rgba(212,161,31,0.07)]" : ""} ${selected ? "bg-[rgba(212,161,31,0.08)]" : ""}`}
      onClick={() => { onSelect(item); setExpanded((e) => !e); }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isNew && (
              <span className="rounded bg-[rgba(212,161,31,0.85)] px-1 text-[9px] font-bold text-black animate-pulse">LIVE</span>
            )}
            <span className="rounded border border-[rgba(212,161,31,0.2)] bg-[rgba(212,161,31,0.08)] px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
              🐋 WHALE
            </span>
            <span className="text-[10px] text-zinc-500">Whale Alert</span>
            <ImportanceBadge importance={item.importance} />
            <TimeAgoLabel timestamp={item.timestamp} />
          </div>
          <p className="text-xs text-[#f3e9d2] leading-snug font-medium">{item.headline}</p>
        </div>
        <button className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Amount + tickers row */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {item.whaleAmountUsd && (
          <span className="rounded border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.08)] px-2 py-0.5 text-[11px] font-bold text-amber-100">
            {formatUsd(item.whaleAmountUsd)}
          </span>
        )}
        {item.whaleToken && (
          <span className="text-[10px] bg-zinc-800 text-amber-400 border border-zinc-700 px-1.5 py-0.5 rounded">
            {item.whaleToken}
          </span>
        )}
        {item.whaleBlockchain && (
          <span className="text-[10px] text-zinc-500 capitalize">{item.whaleBlockchain}</span>
        )}
        <div className="ml-auto">
          {item.sentiment && (
            <SentimentBadge score={item.sentiment} confidence={75} />
          )}
        </div>
      </div>

      {quickPresets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickTrade?.(preset, item);
              }}
              className="rounded-full border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.08)] px-2 py-1 text-[10px] font-bold text-amber-100 transition-colors hover:border-[rgba(212,161,31,0.32)] hover:bg-[rgba(212,161,31,0.14)]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-zinc-800 pt-2">
          {item.whaleFrom && item.whaleTo && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded font-mono truncate max-w-[120px]">
                {item.whaleFrom}
              </span>
              <ArrowRightLeft className="w-3 h-3 text-amber-200 shrink-0" />
              <span className="text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded font-mono truncate max-w-[120px]">
                {item.whaleTo}
              </span>
            </div>
          )}
          {item.whaleTxHash && (
            <a
              href={`https://etherscan.io/tx/${item.whaleTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-amber-200 hover:text-amber-100"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
              View on Explorer
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Social / Tweet Card ──────────────────────────────────────────────────────
function SocialCard({ item, isNew, onSelect, onTickerSelect, onQuickTrade, selected }: Props) {
  const [expanded, setExpanded] = useState(false);
  const quickPresets = buildNewsTradePresets(item);
  const catColor = CATEGORY_COLORS[item.authorCategory || "analyst"] || CATEGORY_COLORS.analyst;

  return (
    <div
      className={`news-card border-b border-[rgba(212,161,31,0.08)] px-3 py-3 cursor-pointer transition-colors ${
        selected ? "bg-[rgba(212,161,31,0.08)] border-l-2 border-l-[rgba(212,161,31,0.7)]" : "hover:bg-[rgba(212,161,31,0.05)]"
      } ${isNew ? "bg-sky-950/12" : ""}`}
      onClick={() => { onSelect(item); setExpanded((e) => !e); }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isNew && (
              <span className="text-[9px] bg-sky-500 text-white px-1 rounded font-bold animate-pulse">LIVE</span>
            )}
            {/* Author badge */}
            <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded ${catColor}`}>
              {item.authorHandle || item.author || "Social"}
            </span>
            <ImportanceBadge importance={item.importance} />
            {item.authorCategory && (
              <span className="text-[9px] text-zinc-600 capitalize">{item.authorCategory}</span>
            )}
            <TimeAgoLabel timestamp={item.timestamp} />
            <span className="text-[9px] font-bold text-sky-400 ml-auto">𝕏</span>
          </div>
          <p className="text-xs text-[#ece4d2] leading-snug font-medium line-clamp-3">{item.headline}</p>
        </div>
        <button className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Tickers */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {item.ticker.slice(0, 3).map((t) => (
          <button
            key={t}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTickerSelect?.(t, item);
            }}
            className="text-[10px] bg-zinc-800 text-amber-400 border border-zinc-700 px-1.5 py-0.5 rounded transition-colors hover:border-amber-400/40 hover:text-amber-200"
          >
            {t}
          </button>
        ))}
        <div className="ml-auto">
          {item.sentiment && item.sentiment !== "neutral" && (
            <SentimentBadge score={item.sentiment} confidence={65} />
          )}
        </div>
      </div>

      {quickPresets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickTrade?.(preset, item);
              }}
              className="rounded-full border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.08)] px-2 py-1 text-[10px] font-bold text-amber-100 transition-colors hover:border-[rgba(212,161,31,0.32)] hover:bg-[rgba(212,161,31,0.14)]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {expanded && item.summary && item.summary !== item.headline && (
        <div className="mt-2 border-t border-zinc-800 pt-2">
          <p className="text-[11px] text-zinc-400 leading-relaxed">{item.summary}</p>
          {item.url && item.url !== "#" && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" /> View Post
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Standard News Card ───────────────────────────────────────────────────────
function NewsCardInner({ item, isNew, onSelect, onTickerSelect, onQuickTrade, selected }: Props) {
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [sentiment, setSentiment] = useState<{
    score: string; confidence: number; reason: string;
  } | null>(
    item.sentiment
      ? { score: item.sentiment, confidence: item.sentimentScore ?? 70, reason: item.sentimentReason ?? "" }
      : null
  );
  const [expanded, setExpanded] = useState(false);
  const quickPresets = buildNewsTradePresets(item);

  const fetchSentiment = async () => {
    if (sentiment || loadingSentiment) return;
    setLoadingSentiment(true);
    try {
      const res = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: item.headline, summary: item.summary }),
      });
      const data = await res.json();
      setSentiment(data);
    } catch { /* ignore */ } finally {
      setLoadingSentiment(false);
    }
  };

  return (
    <div
      className={`news-card border-b border-[rgba(212,161,31,0.08)] px-3 py-3 cursor-pointer transition-colors ${
        selected ? "bg-[rgba(212,161,31,0.08)] border-l-2 border-l-[rgba(212,161,31,0.7)]" : "hover:bg-[rgba(212,161,31,0.05)]"
      } ${isNew ? "animate-pulse-once bg-[rgba(212,161,31,0.06)]" : ""}`}
      onClick={() => { onSelect(item); fetchSentiment(); setExpanded((e) => !e); }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isNew && (
              <span className="text-[9px] bg-green-500 text-black px-1 rounded font-bold animate-pulse">LIVE</span>
            )}
            <span className="text-[10px] text-zinc-500">{item.source}</span>
            <SourceTierBadge tier={item.sourceTier} />
            <ImportanceBadge importance={item.importance} />
            <TimeAgoLabel timestamp={item.timestamp} />
          </div>
          <p className="text-xs text-[#f4ecda] leading-snug font-medium line-clamp-2">{item.headline}</p>
        </div>
        <button className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {item.ticker.map((t) => (
          <button
            key={t}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTickerSelect?.(t, item);
            }}
            className="text-[10px] bg-zinc-800 text-amber-400 border border-zinc-700 px-1.5 py-0.5 rounded transition-colors hover:border-amber-400/40 hover:text-amber-200"
          >
            {t}
          </button>
        ))}
        <span className="text-[10px] text-zinc-600 ml-1">{item.sector}</span>
        <div className="ml-auto">
          {loadingSentiment ? (
            <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />
          ) : sentiment ? (
            <SentimentBadge score={sentiment.score} confidence={sentiment.confidence} />
          ) : null}
        </div>
      </div>

      {quickPresets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickTrade?.(preset, item);
              }}
              className="rounded-full border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.08)] px-2 py-1 text-[10px] font-bold text-amber-100 transition-colors hover:border-[rgba(212,161,31,0.32)] hover:bg-[rgba(212,161,31,0.14)]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[11px] text-zinc-400 leading-relaxed">{item.summary}</p>
          {sentiment?.reason && (
            <p className="text-[10px] text-zinc-500 italic border-l-2 border-zinc-700 pl-2">
              AI: {sentiment.reason}
            </p>
          )}
          {item.url && item.url !== "#" && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-green-500 hover:text-green-400"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" /> Read Article
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export — routes to correct card variant ─────────────────────────────
export default function NewsCard(props: Props) {
  if (props.item.type === "whale") return <WhaleCard {...props} />;
  if (props.item.type === "social") return <SocialCard {...props} />;
  return <NewsCardInner {...props} />;
}
