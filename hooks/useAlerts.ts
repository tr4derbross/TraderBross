"use client";

import { useEffect, useRef, useState } from "react";
import { NewsItem } from "@/lib/mock-data";
import type { TickerQuote } from "@/lib/mock-data";

export type Alert = {
  id: string;
  name: string;
  // News alerts
  ticker?: string;
  keyword?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  // Price alerts
  priceAbove?: number;
  priceBelow?: number;
  priceTriggered?: boolean; // one-shot: disable after first trigger
  enabled: boolean;
  triggeredCount: number;
  createdAt?: number;
};

const STORAGE_KEY = "trading-terminal-alerts";

function loadAlerts(): Alert[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveAlerts(alerts: Alert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // Track which price alerts have been notified to avoid repeat fires
  const firedRef = useRef(new Set<string>());

  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  const addAlert = (alert: Omit<Alert, "id" | "triggeredCount" | "createdAt">) => {
    const newAlert: Alert = {
      ...alert,
      id: Date.now().toString(),
      triggeredCount: 0,
      createdAt: Date.now(),
    };
    setAlerts((prev) => {
      const next = [...prev, newAlert];
      saveAlerts(next);
      return next;
    });
  };

  const removeAlert = (id: string) => {
    firedRef.current.delete(id);
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAlerts(next);
      return next;
    });
  };

  const toggleAlert = (id: string) => {
    firedRef.current.delete(id); // re-arm on re-enable
    setAlerts((prev) => {
      const next = prev.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      );
      saveAlerts(next);
      return next;
    });
  };

  // ── News alert checking ────────────────────────────────────────────────────
  const checkNewsAgainstAlerts = (item: NewsItem) => {
    const triggered: Alert[] = [];

    alerts.forEach((alert) => {
      if (!alert.enabled) return;
      // Skip pure price alerts
      if (!alert.ticker && !alert.keyword && !alert.sentiment) return;
      if (alert.priceAbove != null || alert.priceBelow != null) return;

      const tickerMatch =
        alert.ticker && item.ticker.includes(alert.ticker.toUpperCase());
      const keywordMatch =
        alert.keyword &&
        (item.headline.toLowerCase().includes(alert.keyword.toLowerCase()) ||
          item.summary.toLowerCase().includes(alert.keyword.toLowerCase()));
      const sentimentMatch =
        alert.sentiment && item.sentiment === alert.sentiment;

      if (tickerMatch || keywordMatch || sentimentMatch) {
        triggered.push(alert);
      }
    });

    if (triggered.length > 0) {
      triggered.forEach((alert) => {
        if (Notification.permission === "granted") {
          new Notification(`Alert: ${alert.name}`, {
            body: item.headline,
            icon: "/favicon.ico",
          });
        }
        setAlerts((prev) => {
          const next = prev.map((a) =>
            a.id === alert.id ? { ...a, triggeredCount: a.triggeredCount + 1 } : a
          );
          saveAlerts(next);
          return next;
        });
      });
    }
  };

  // ── Price alert checking (call with live wsQuotes) ─────────────────────────
  const checkPriceAlerts = (quotes: TickerQuote[]) => {
    if (!quotes.length) return;

    const priceMap = new Map(quotes.map((q) => [q.symbol, q.price]));

    alerts.forEach((alert) => {
      if (!alert.enabled) return;
      if (alert.priceAbove == null && alert.priceBelow == null) return;
      if (!alert.ticker) return;
      if (firedRef.current.has(alert.id)) return;

      const price = priceMap.get(alert.ticker);
      if (price == null) return;

      const hitAbove = alert.priceAbove != null && price >= alert.priceAbove;
      const hitBelow = alert.priceBelow != null && price <= alert.priceBelow;

      if (hitAbove || hitBelow) {
        firedRef.current.add(alert.id);

        const dir  = hitAbove ? "above" : "below";
        const lvl  = hitAbove ? alert.priceAbove! : alert.priceBelow!;
        const body = `${alert.ticker} is ${dir} $${lvl.toLocaleString()} (now $${price.toLocaleString()})`;

        if (Notification.permission === "granted") {
          new Notification(`🔔 Price Alert: ${alert.name}`, {
            body,
            icon: "/favicon.ico",
          });
        }

        setAlerts((prev) => {
          const next = prev.map((a) =>
            a.id === alert.id
              ? { ...a, triggeredCount: a.triggeredCount + 1, enabled: false }
              : a
          );
          saveAlerts(next);
          return next;
        });
      }
    });
  };

  const requestNotificationPermission = () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  return {
    alerts,
    addAlert,
    removeAlert,
    toggleAlert,
    checkNewsAgainstAlerts,
    checkPriceAlerts,
    requestNotificationPermission,
  };
}
