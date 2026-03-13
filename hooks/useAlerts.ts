"use client";

import { useEffect, useState } from "react";
import { NewsItem } from "@/lib/mock-data";

export type Alert = {
  id: string;
  name: string;
  ticker?: string;
  keyword?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  enabled: boolean;
  triggeredCount: number;
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

  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  const addAlert = (alert: Omit<Alert, "id" | "triggeredCount">) => {
    const newAlert: Alert = { ...alert, id: Date.now().toString(), triggeredCount: 0 };
    setAlerts((prev) => {
      const next = [...prev, newAlert];
      saveAlerts(next);
      return next;
    });
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAlerts(next);
      return next;
    });
  };

  const toggleAlert = (id: string) => {
    setAlerts((prev) => {
      const next = prev.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      );
      saveAlerts(next);
      return next;
    });
  };

  const checkNewsAgainstAlerts = (item: NewsItem) => {
    const triggered: Alert[] = [];

    alerts.forEach((alert) => {
      if (!alert.enabled) return;

      const tickerMatch =
        alert.ticker && item.ticker.includes(alert.ticker.toUpperCase());
      const keywordMatch =
        alert.keyword &&
        (item.headline.toLowerCase().includes(alert.keyword.toLowerCase()) ||
          item.summary.toLowerCase().includes(alert.keyword.toLowerCase()));
      const sentimentMatch =
        alert.sentiment &&
        item.sentiment === alert.sentiment;

      if (tickerMatch || keywordMatch || sentimentMatch) {
        triggered.push(alert);
      }
    });

    if (triggered.length > 0) {
      triggered.forEach((alert) => {
        // Browser notification
        if (Notification.permission === "granted") {
          new Notification(`Alert: ${alert.name}`, {
            body: item.headline,
            icon: "/favicon.ico",
          });
        }
        // Increment count
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

  const requestNotificationPermission = () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  return { alerts, addAlert, removeAlert, toggleAlert, checkNewsAgainstAlerts, requestNotificationPermission };
}
