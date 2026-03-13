"use client";

import { useState } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import { AVAILABLE_TICKERS } from "@/lib/mock-data";
import { Bell, BellOff, Plus, Trash2, BellRing } from "lucide-react";

export default function AlertPanel() {
  const { alerts, addAlert, removeAlert, toggleAlert, requestNotificationPermission } =
    useAlerts();

  const [form, setForm] = useState({
    name: "",
    ticker: "",
    keyword: "",
    sentiment: "" as "" | "bullish" | "bearish" | "neutral",
  });
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addAlert({
      name: form.name,
      ticker: form.ticker || undefined,
      keyword: form.keyword || undefined,
      sentiment: (form.sentiment || undefined) as "bullish" | "bearish" | "neutral" | undefined,
      enabled: true,
    });
    setForm({ name: "", ticker: "", keyword: "", sentiment: "" });
    setShowForm(false);
    requestNotificationPermission();
  };

  return (
    <div className="flex h-full flex-col">
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

      {showForm && (
        <div className="panel-shell-alt space-y-2 border-b px-3 py-3">
          <input
            className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
            placeholder="Alert name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="terminal-input rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
              value={form.ticker}
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
            >
              <option value="" className="bg-zinc-900 text-zinc-400">
                Ticker (any)
              </option>
              {AVAILABLE_TICKERS.map((t) => (
                <option key={t} value={t} className="bg-zinc-900">
                  {t}
                </option>
              ))}
            </select>
            <select
              className="terminal-input rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
              value={form.sentiment}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sentiment: e.target.value as typeof form.sentiment,
                }))
              }
            >
              <option value="" className="bg-zinc-900 text-zinc-400">
                Sentiment (any)
              </option>
              <option value="bullish" className="bg-zinc-900">
                Bullish
              </option>
              <option value="bearish" className="bg-zinc-900">
                Bearish
              </option>
              <option value="neutral" className="bg-zinc-900">
                Neutral
              </option>
            </select>
          </div>
          <input
            className="terminal-input w-full rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-zinc-600"
            placeholder='Keyword (e.g. "earnings", "FDA")'
            value={form.keyword}
            onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="brand-chip-active flex-1 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition hover:brightness-110"
            >
              Create Alert
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="terminal-chip rounded-xl px-3 py-2 text-[10px] text-zinc-300 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center gap-2 text-zinc-500">
            <Bell className="h-6 w-6 text-zinc-700" />
            <span className="text-xs">No alerts configured</span>
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-amber-200 transition hover:text-amber-100"
            >
              Create your first alert
            </button>
          </div>
        ) : (
          alerts.map((alert) => (
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
                  <p
                    className={`text-xs font-medium ${
                      alert.enabled ? "text-[#f4ecda]" : "text-zinc-500"
                    }`}
                  >
                    {alert.name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {alert.ticker && (
                      <span className="brand-badge brand-badge-gold rounded-md px-1.5 py-0.5 text-[10px]">
                        {alert.ticker}
                      </span>
                    )}
                    {alert.keyword && (
                      <span className="brand-badge rounded-md px-1.5 py-0.5 text-[10px]">
                        "{alert.keyword}"
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
