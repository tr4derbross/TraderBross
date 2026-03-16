"use client";

import { useState } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import { AVAILABLE_TICKERS } from "@/lib/mock-data";
import {
  Bell,
  BellOff,
  Plus,
  Trash2,
  BellRing,
  TrendingUp,
  TrendingDown,
  Newspaper,
} from "lucide-react";

type AlertTab = "news" | "price";

export default function AlertPanel() {
  const { alerts, addAlert, removeAlert, toggleAlert, requestNotificationPermission } =
    useAlerts();

  const [tab, setTab] = useState<AlertTab>("price");
  const [showForm, setShowForm] = useState(false);

  // News alert form
  const [newsForm, setNewsForm] = useState({
    name: "",
    ticker: "",
    keyword: "",
    sentiment: "" as "" | "bullish" | "bearish" | "neutral",
  });

  // Price alert form
  const [priceForm, setPriceForm] = useState({
    name: "",
    ticker: "",
    direction: "above" as "above" | "below",
    price: "",
  });

  const handleAddNews = () => {
    if (!newsForm.name.trim()) return;
    addAlert({
      name: newsForm.name,
      ticker: newsForm.ticker || undefined,
      keyword: newsForm.keyword || undefined,
      sentiment: (newsForm.sentiment || undefined) as "bullish" | "bearish" | "neutral" | undefined,
      enabled: true,
    });
    setNewsForm({ name: "", ticker: "", keyword: "", sentiment: "" });
    setShowForm(false);
    requestNotificationPermission();
  };

  const handleAddPrice = () => {
    if (!priceForm.name.trim() || !priceForm.ticker || !priceForm.price) return;
    const price = parseFloat(priceForm.price);
    if (isNaN(price) || price <= 0) return;
    addAlert({
      name: priceForm.name,
      ticker: priceForm.ticker,
      priceAbove: priceForm.direction === "above" ? price : undefined,
      priceBelow: priceForm.direction === "below" ? price : undefined,
      enabled: true,
    });
    setPriceForm({ name: "", ticker: "", direction: "above", price: "" });
    setShowForm(false);
    requestNotificationPermission();
  };

  const priceAlerts = alerts.filter((a) => a.priceAbove != null || a.priceBelow != null);
  const newsAlerts  = alerts.filter((a) => a.priceAbove == null && a.priceBelow == null);
  const displayed   = tab === "price" ? priceAlerts : newsAlerts;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="panel-header soft-divider flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <BellRing className="h-3.5 w-3.5 text-amber-200" />
          <span className="brand-section-title text-xs">Alerts</span>
          <span className="brand-badge rounded-full px-1.5 py-0.5 text-[10px]">
            {alerts.filter((a) => a.enabled).length} active
          </span>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="brand-badge rounded-full px-2 py-1 text-[10px] transition hover:text-amber-100"
        >
          <span className="inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" />
            New
          </span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-[rgba(212,161,31,0.08)] px-3 pt-2 pb-0">
        {(["price", "news"] as AlertTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1 border-b-2 pb-1.5 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
              tab === t
                ? "border-amber-400/60 text-amber-300"
                : "border-transparent text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {t === "price" ? <TrendingUp className="h-3 w-3" /> : <Newspaper className="h-3 w-3" />}
            {t === "price" ? `Price (${priceAlerts.length})` : `News (${newsAlerts.length})`}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="panel-shell-alt space-y-2 border-b px-3 py-3">
          {tab === "price" ? (
            <>
              <input
                className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                placeholder="Alert name *"
                value={priceForm.name}
                onChange={(e) => setPriceForm((f) => ({ ...f, name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="terminal-input rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                  value={priceForm.ticker}
                  onChange={(e) => setPriceForm((f) => ({ ...f, ticker: e.target.value }))}
                >
                  <option value="" className="bg-zinc-900 text-zinc-400">Ticker *</option>
                  {AVAILABLE_TICKERS.map((t) => (
                    <option key={t} value={t} className="bg-zinc-900">{t}</option>
                  ))}
                </select>
                <select
                  className="terminal-input rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                  value={priceForm.direction}
                  onChange={(e) => setPriceForm((f) => ({ ...f, direction: e.target.value as "above" | "below" }))}
                >
                  <option value="above" className="bg-zinc-900">Price above ↑</option>
                  <option value="below" className="bg-zinc-900">Price below ↓</option>
                </select>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                placeholder="Target price (USD) *"
                value={priceForm.price}
                onChange={(e) => setPriceForm((f) => ({ ...f, price: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddPrice}
                  className="brand-chip-active flex-1 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition hover:brightness-110"
                >
                  Create Price Alert
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="terminal-chip rounded-xl px-3 py-2 text-[10px] text-zinc-300 transition hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                placeholder="Alert name *"
                value={newsForm.name}
                onChange={(e) => setNewsForm((f) => ({ ...f, name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="terminal-input rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                  value={newsForm.ticker}
                  onChange={(e) => setNewsForm((f) => ({ ...f, ticker: e.target.value }))}
                >
                  <option value="" className="bg-zinc-900 text-zinc-400">Ticker (any)</option>
                  {AVAILABLE_TICKERS.map((t) => (
                    <option key={t} value={t} className="bg-zinc-900">{t}</option>
                  ))}
                </select>
                <select
                  className="terminal-input rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                  value={newsForm.sentiment}
                  onChange={(e) =>
                    setNewsForm((f) => ({ ...f, sentiment: e.target.value as typeof newsForm.sentiment }))
                  }
                >
                  <option value="" className="bg-zinc-900 text-zinc-400">Sentiment (any)</option>
                  <option value="bullish" className="bg-zinc-900">Bullish</option>
                  <option value="bearish" className="bg-zinc-900">Bearish</option>
                  <option value="neutral" className="bg-zinc-900">Neutral</option>
                </select>
              </div>
              <input
                className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
                placeholder='Keyword (e.g. "SEC", "ETF")'
                value={newsForm.keyword}
                onChange={(e) => setNewsForm((f) => ({ ...f, keyword: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddNews}
                  className="brand-chip-active flex-1 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition hover:brightness-110"
                >
                  Create News Alert
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="terminal-chip rounded-xl px-3 py-2 text-[10px] text-zinc-300 transition hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center gap-2 text-zinc-500">
            <Bell className="h-6 w-6 text-zinc-700" />
            <span className="text-xs">No {tab} alerts configured</span>
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-amber-200 transition hover:text-amber-100"
            >
              Create your first alert
            </button>
          </div>
        ) : (
          displayed.map((alert) => (
            <div
              key={alert.id}
              className="border-b border-[rgba(212,161,31,0.08)] px-3 py-2.5 transition-colors hover:bg-[rgba(212,161,31,0.03)]"
            >
              <div className="flex items-start gap-2">
                <button onClick={() => toggleAlert(alert.id)} className="mt-0.5 shrink-0">
                  {alert.enabled ? (
                    <Bell className="h-3.5 w-3.5 text-amber-200" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5 text-zinc-600" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium ${alert.enabled ? "text-[#f4ecda]" : "text-zinc-500"}`}>
                    {alert.name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {alert.ticker && (
                      <span className="brand-badge brand-badge-gold rounded-md px-1.5 py-0.5 text-[10px]">
                        {alert.ticker}
                      </span>
                    )}
                    {alert.priceAbove != null && (
                      <span className="inline-flex items-center gap-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                        <TrendingUp className="h-2.5 w-2.5" />
                        above ${alert.priceAbove.toLocaleString()}
                      </span>
                    )}
                    {alert.priceBelow != null && (
                      <span className="inline-flex items-center gap-0.5 rounded-md border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400">
                        <TrendingDown className="h-2.5 w-2.5" />
                        below ${alert.priceBelow.toLocaleString()}
                      </span>
                    )}
                    {alert.keyword && (
                      <span className="brand-badge rounded-md px-1.5 py-0.5 text-[10px]">
                        &quot;{alert.keyword}&quot;
                      </span>
                    )}
                    {alert.sentiment && (
                      <span
                        className={`brand-badge rounded-md px-1.5 py-0.5 text-[10px] ${
                          alert.sentiment === "bullish"
                            ? "brand-badge-success"
                            : alert.sentiment === "bearish"
                              ? "brand-badge-danger"
                              : ""
                        }`}
                      >
                        {alert.sentiment}
                      </span>
                    )}
                  </div>
                  {alert.triggeredCount > 0 && (
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Triggered {alert.triggeredCount}x
                    </p>
                  )}
                </div>

                <button
                  onClick={() => removeAlert(alert.id)}
                  className="shrink-0 text-zinc-700 transition-colors hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
