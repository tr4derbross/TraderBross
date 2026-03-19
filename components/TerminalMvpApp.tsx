"use client";

import { useEffect, useMemo, useState } from "react";
import PriceChart from "@/components/PriceChart";
import { apiFetch } from "@/lib/api-client";
import { useRealtimeSelector } from "@/lib/realtime-client";

type SortMode = "recency" | "priority" | "relevance";
type FeedMode = "all" | "news" | "whale";

type AnalysisPayload = {
  summary: string;
  whyItMatters: string;
  affectedAssets: string[];
  bullishFactors: string[];
  bearishFactors: string[];
  riskNotes: string[];
  tradeCaution: string;
};

type UnifiedEvent = {
  id: string;
  kind: "news" | "whale";
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  relatedAssets: string[];
  watchlistRelevance: number;
  priorityScore: number;
  priorityLabel?: string;
  labels: string[];
  url?: string;
  eventType?: string;
  chain?: string;
  usdValue?: number;
};

const WATCHLIST_DEFAULT = ["BTC", "ETH", "SOL", "BNB", "XRP"];

function fmtAge(value: string) {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "unknown";
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / (24 * 60))}d`;
}

function fmtUsd(value?: number) {
  if (!value || !Number.isFinite(value)) return "-";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

function statusTone(status: string) {
  if (status === "live") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (status === "degraded") return "bg-amber-500/10 text-amber-200 border-amber-500/30";
  if (status === "stale") return "bg-orange-500/10 text-orange-200 border-orange-500/30";
  if (status === "reconnecting" || status === "connecting") return "bg-zinc-700/30 text-zinc-300 border-zinc-600";
  return "bg-rose-500/10 text-rose-200 border-rose-500/30";
}

function mapRelevanceLabel(label: string) {
  if (label === "watchlist_hit") return "watchlist hit";
  if (label === "high_priority") return "high priority";
  if (label === "direct_exposure") return "direct exposure";
  if (label === "sector_related") return "sector-related";
  if (label === "low_relevance") return "low relevance";
  return label.replace(/_/g, " ");
}

export default function TerminalMvpApp({ initialTicker }: { initialTicker?: string }) {
  const snapshot = useRealtimeSelector((state) => state);
  const [feedMode, setFeedMode] = useState<FeedMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedSymbol, setSelectedSymbol] = useState(initialTicker || WATCHLIST_DEFAULT[0]);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [analysisState, setAnalysisState] = useState<"loading" | "ready" | "empty" | "error">("empty");

  const connectionStatus = snapshot.connectionStatus;
  const watchlist = WATCHLIST_DEFAULT;

  const events = useMemo<UnifiedEvent[]>(() => {
    const newsRows = (snapshot.newsSnapshot?.items || []).map((item) => ({
      id: item.id,
      kind: "news" as const,
      title: item.title,
      summary: item.summary,
      source: item.source,
      timestamp: item.publishedAt,
      relatedAssets: item.relatedAssets || item.tickers || [],
      watchlistRelevance: item.watchlistRelevance || 0,
      priorityScore: item.priority?.score || 0,
      priorityLabel: item.priorityLabel,
      labels: (item.relevanceLabels || []).map(mapRelevanceLabel),
      url: item.url,
      eventType: item.eventType,
    }));
    const whaleRows = (snapshot.whaleEvents || []).map((item) => ({
      id: item.id,
      kind: "whale" as const,
      title: `${item.token} ${item.eventType.replace(/_/g, " ")}`,
      summary: `${item.fromLabel} -> ${item.toLabel} (${fmtUsd(item.usdValue)})`,
      source: item.chain,
      timestamp: item.timestamp,
      relatedAssets: item.relatedAssets || [item.token],
      watchlistRelevance: item.watchlistRelevance || 0,
      priorityScore: item.significance || 0,
      priorityLabel: item.priorityLabel,
      labels: (item.relevanceLabels || []).map(mapRelevanceLabel),
      eventType: item.eventType,
      chain: item.chain,
      usdValue: item.usdValue,
    }));
    const merged = [...newsRows, ...whaleRows];
    return merged.filter((row) => {
      if (feedMode === "all") return true;
      return row.kind === feedMode;
    });
  }, [feedMode, snapshot.newsSnapshot?.items, snapshot.whaleEvents]);

  const sortedEvents = useMemo(() => {
    const next = [...events];
    next.sort((a, b) => {
      if (sortMode === "priority") return b.priorityScore - a.priorityScore;
      if (sortMode === "relevance") {
        if (b.watchlistRelevance !== a.watchlistRelevance) return b.watchlistRelevance - a.watchlistRelevance;
        return b.priorityScore - a.priorityScore;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    return next;
  }, [events, sortMode]);

  const selectedEvent = useMemo(
    () => sortedEvents.find((item) => item.id === selectedId) || sortedEvents[0] || null,
    [selectedId, sortedEvents],
  );

  useEffect(() => {
    if (!selectedEvent) return;
    if (!selectedId || !sortedEvents.some((item) => item.id === selectedId)) {
      setSelectedId(selectedEvent.id);
    }
    const firstAsset = selectedEvent.relatedAssets[0];
    if (firstAsset) setSelectedSymbol(firstAsset);
  }, [selectedEvent, selectedId, sortedEvents]);

  useEffect(() => {
    if (!selectedEvent) {
      setAnalysis(null);
      setAnalysisState("empty");
      return;
    }
    let active = true;
    setAnalysisState("loading");
    apiFetch<AnalysisPayload>(`/api/analysis?kind=${selectedEvent.kind}&id=${selectedEvent.id}`)
      .then((payload) => {
        if (!active) return;
        setAnalysis(payload);
        setAnalysisState("ready");
      })
      .catch(() => {
        if (!active) return;
        setAnalysis(null);
        setAnalysisState("error");
      });
    return () => {
      active = false;
    };
  }, [selectedEvent?.id, selectedEvent?.kind]);

  const providerIssues = useMemo(() => {
    const health = snapshot.providerHealth || {};
    return Object.entries(health).filter(([, value]) => value?.status === "degraded");
  }, [snapshot.providerHealth]);

  return (
    <div className="min-h-screen bg-[#0b0b0b] px-3 py-3 text-[#f5efe1] md:px-4">
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#121212] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Terminal v1</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusTone(connectionStatus)}`}>
            {connectionStatus}
          </span>
          <span className="text-[10px] text-zinc-500">Last update: {snapshot.lastUpdatedAt ? fmtAge(new Date(snapshot.lastUpdatedAt).toISOString()) : "-"}</span>
          <span className="ml-auto text-[10px] text-zinc-500">
            News {snapshot.newsSnapshot?.count || 0} | Whales {(snapshot.whaleEvents || []).length} | Quotes {(snapshot.quotes || []).length}
          </span>
        </div>

        <div className="grid gap-3 xl:grid-cols-[380px_1fr_420px]">
          <section className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-2">
            <div className="mb-2 flex items-center gap-2">
              <button onClick={() => setFeedMode("all")} className={`rounded-md px-2 py-1 text-[10px] ${feedMode === "all" ? "brand-chip-active" : "terminal-chip"}`}>All</button>
              <button onClick={() => setFeedMode("news")} className={`rounded-md px-2 py-1 text-[10px] ${feedMode === "news" ? "brand-chip-active" : "terminal-chip"}`}>News</button>
              <button onClick={() => setFeedMode("whale")} className={`rounded-md px-2 py-1 text-[10px] ${feedMode === "whale" ? "brand-chip-active" : "terminal-chip"}`}>Whale</button>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="ml-auto rounded-md border border-[#2a2a2a] bg-[#0b0b0b] px-2 py-1 text-[10px]"
              >
                <option value="relevance">Sort: relevance</option>
                <option value="priority">Sort: priority</option>
                <option value="recency">Sort: recency</option>
              </select>
            </div>
            <div className="max-h-[74vh] overflow-y-auto">
              {sortedEvents.length === 0 ? (
                <div className="rounded-lg border border-[#2a2a2a] bg-black/30 p-4 text-[12px] text-zinc-500">
                  {connectionStatus === "connecting" || connectionStatus === "reconnecting" ? "loading feed..." : "no data"}
                </div>
              ) : (
                sortedEvents.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                    }}
                    className={`mb-1 w-full rounded-lg border p-2 text-left transition ${
                      selectedEvent?.id === item.id
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-[#2a2a2a] bg-black/20 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${item.kind === "whale" ? "bg-sky-500/10 text-sky-300" : "bg-zinc-700/40 text-zinc-200"}`}>
                        {item.kind}
                      </span>
                      <span className="text-[9px] text-zinc-500">{item.source}</span>
                      <span className="ml-auto text-[9px] text-zinc-600">{fmtAge(item.timestamp)}</span>
                    </div>
                    <div className="line-clamp-2 text-[12px] font-medium">{item.title}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-zinc-400">{item.summary}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {item.relatedAssets.slice(0, 4).map((asset) => (
                        <span key={asset} className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-100">{asset}</span>
                      ))}
                      <span className="ml-auto text-[10px] text-zinc-500">rel {Math.round(item.watchlistRelevance)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="grid gap-2 rounded-xl border border-[#2a2a2a] bg-[#111111] p-3 md:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Market Cap</div>
                <div className="text-[14px] font-semibold">{fmtUsd(snapshot.marketStats?.marketCapUsd || undefined)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">BTC Dominance</div>
                <div className="text-[14px] font-semibold">{snapshot.marketStats?.btcDominance != null ? `${snapshot.marketStats.btcDominance.toFixed(1)}%` : "-"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">24h Volume</div>
                <div className="text-[14px] font-semibold">{fmtUsd(snapshot.marketStats?.total24hVolume || undefined)}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0d0f14]">
              <PriceChart
                activeVenue="binance"
                activeSymbol={selectedSymbol}
                marketDataSourceLabel="Binance"
                liveTickerPrice={snapshot.quotes.find((q) => q.symbol === selectedSymbol)?.price}
                liveFeedConnected={connectionStatus === "live" || connectionStatus === "degraded"}
                onTickerChange={(ticker) => setSelectedSymbol(ticker)}
              />
            </div>

            <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">Watchlist Relevance</div>
              <div className="grid grid-cols-5 gap-2">
                {watchlist.map((asset) => {
                  const q = snapshot.quotes.find((row) => row.symbol === asset);
                  return (
                    <button
                      key={asset}
                      onClick={() => setSelectedSymbol(asset)}
                      className={`rounded-md border p-2 text-left ${selectedSymbol === asset ? "border-amber-500/40 bg-amber-500/10" : "border-[#2a2a2a] bg-black/20"}`}
                    >
                      <div className="text-[10px] font-semibold">{asset}</div>
                      <div className="text-[10px] text-zinc-400">{q ? q.price.toLocaleString("en-US") : "-"}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Selected Event</div>
                {selectedEvent?.kind === "whale" && selectedEvent.usdValue ? (
                  <span className="text-[10px] text-sky-300">{fmtUsd(selectedEvent.usdValue)}</span>
                ) : null}
              </div>
              {!selectedEvent ? (
                <div className="text-[12px] text-zinc-500">no data</div>
              ) : (
                <div>
                  <div className="text-[13px] font-semibold">{selectedEvent.title}</div>
                  <div className="mt-1 text-[11px] text-zinc-400">{selectedEvent.source} | {new Date(selectedEvent.timestamp).toLocaleString()}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedEvent.relatedAssets.map((asset) => (
                      <span key={asset} className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-100">{asset}</span>
                    ))}
                    {(selectedEvent.labels || []).slice(0, 3).map((label) => (
                      <span key={label} className="rounded border border-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-300">{label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">Event Analysis</div>
              {analysisState === "loading" && <div className="text-[12px] text-zinc-500">loading...</div>}
              {analysisState === "error" && <div className="text-[12px] text-amber-200">analysis unavailable (degraded)</div>}
              {analysisState === "ready" && analysis ? (
                <div className="space-y-2 text-[12px]">
                  <p><span className="text-zinc-500">Summary:</span> {analysis.summary}</p>
                  <p><span className="text-zinc-500">Why:</span> {analysis.whyItMatters}</p>
                  <p><span className="text-emerald-300">Bullish:</span> {analysis.bullishFactors.join(" | ") || "-"}</p>
                  <p><span className="text-rose-300">Bearish:</span> {analysis.bearishFactors.join(" | ") || "-"}</p>
                  <p><span className="text-zinc-400">Risk:</span> {analysis.riskNotes.join(" | ")}</p>
                  <p><span className="text-amber-200">Trade caution:</span> {analysis.tradeCaution}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">System State</div>
              {providerIssues.length === 0 ? (
                <div className="text-[12px] text-emerald-300">live or cached</div>
              ) : (
                <div className="space-y-1 text-[11px] text-amber-200">
                  {providerIssues.map(([name]) => (
                    <div key={name}>{name} degraded</div>
                  ))}
                </div>
              )}
              {process.env.NODE_ENV === "development" ? (
                <pre className="mt-2 max-h-36 overflow-auto rounded border border-[#2a2a2a] bg-black/30 p-2 text-[10px] text-zinc-400">
                  {JSON.stringify(snapshot.providerHealth || {}, null, 2)}
                </pre>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
