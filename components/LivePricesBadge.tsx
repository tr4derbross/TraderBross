"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Quote {
  symbol: string;
  price: number;
  changePct: number;
}

const SYMBOLS = ["BTC", "ETH", "SOL"];

export default function LivePricesBadge() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/prices?type=quotes");
        if (!res.ok) return;
        const data: Quote[] = await res.json();
        const filtered = data.filter((q) => SYMBOLS.includes(q.symbol));
        setQuotes(filtered);
      } catch {
        // silent fallback
      }
    };

    load();
    const id = setInterval(() => {
      load();
      setFlash(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      setTimeout(() => setFlash(null), 600);
    }, 12000);

    return () => clearInterval(id);
  }, []);

  if (!quotes.length) {
    return (
      <div className="flex items-center gap-2">
        {SYMBOLS.map((s) => (
          <div key={s} className="skeleton-shimmer h-8 w-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {quotes.map((q) => {
        const isUp = q.changePct >= 0;
        const isFlashing = flash === q.symbol;
        return (
          <div
            key={q.symbol}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all duration-300 ${
              isFlashing
                ? isUp
                  ? "border-emerald-500/30 bg-emerald-500/8"
                  : "border-red-500/30 bg-red-500/8"
                : "border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.04)]"
            }`}
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-400">
              {q.symbol}
            </span>
            <span className="font-mono text-[12px] font-semibold text-[#f5efe1]">
              ${q.price.toLocaleString("en-US", { maximumFractionDigits: q.price > 1000 ? 0 : 2 })}
            </span>
            <span
              className={`flex items-center gap-0.5 text-[10px] font-bold ${
                isUp ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isUp ? "+" : ""}
              {(q.changePct ?? 0).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
