"use client";

import { useState, useEffect } from "react";

type Session = {
  name: string;
  short: string;
  openHour: number;
  closeHour: number;
  color: string;
  glow: string;
};

const SESSIONS: Session[] = [
  { name: "Asia",     short: "ASIA", openHour: 0,  closeHour: 9,  color: "#818cf8", glow: "rgba(129,140,248,0.28)" },
  { name: "Europe",   short: "EU",   openHour: 7,  closeHour: 16, color: "#34d399", glow: "rgba(52,211,153,0.28)"  },
  { name: "Americas", short: "US",   openHour: 13, closeHour: 22, color: "#f59e0b", glow: "rgba(245,158,11,0.28)"  },
];

function isOpen(session: Session, utcH: number): boolean {
  if (session.openHour < session.closeHour) {
    return utcH >= session.openHour && utcH < session.closeHour;
  }
  return utcH >= session.openHour || utcH < session.closeHour;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function MarketSessionBar() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const utcH = now ? now.getUTCHours() : 0;
  const utcM = now ? now.getUTCMinutes() : 0;
  const utcS = now ? now.getUTCSeconds() : 0;
  const totalSec = utcH * 3600 + utcM * 60 + utcS;
  const dayPct = (totalSec / 86400) * 100;
  const timeStr = now ? `${pad(utcH)}:${pad(utcM)}:${pad(utcS)}` : "--:--:--";

  const openSessions = SESSIONS.filter((s) => isOpen(s, utcH));

  return (
    <div className="flex items-center gap-0 overflow-x-auto border-t border-white/[0.035] bg-[rgba(6,8,12,0.92)] px-3 py-[5px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

      {/* ── UTC Clock ── */}
      <div className="flex shrink-0 items-center gap-1.5 border-r border-white/[0.06] pr-3 mr-3">
        <span
          className="h-[5px] w-[5px] shrink-0 rounded-full live-dot"
          style={{ background: "#d4a11f", boxShadow: "0 0 5px #d4a11f88" }}
        />
        <span className="terminal-meta-label">UTC</span>
        <span className="font-mono text-[11px] font-bold tabular-nums text-[#f5efe1] tracking-wider">
          {timeStr}
        </span>
      </div>

      {/* ── Session Badges ── */}
      <div className="flex shrink-0 items-center gap-1.5 border-r border-white/[0.06] pr-3 mr-3">
        {SESSIONS.map((s) => {
          const on = isOpen(s, utcH);
          return (
            <div
              key={s.short}
              className="flex items-center gap-1 rounded-md px-2 py-[3px] transition-all duration-500"
              style={{
                background: on ? `${s.color}16` : "rgba(20,18,15,0.5)",
                border: `1px solid ${on ? `${s.color}40` : "rgba(255,255,255,0.05)"}`,
                boxShadow: on ? `0 0 8px ${s.glow}` : "none",
              }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: on ? s.color : "#2e2c28",
                  boxShadow: on ? `0 0 4px ${s.color}` : "none",
                  animation: on ? "livePulse 1.8s ease-in-out infinite" : "none",
                }}
              />
              <span
                className="text-[9px] font-bold tracking-[0.14em]"
                style={{ color: on ? s.color : "#3a3530" }}
              >
                {s.short}
              </span>
              {on && (
                <span
                  className="text-[8px] font-semibold tracking-[0.08em] hidden sm:inline"
                  style={{ color: `${s.color}99` }}
                >
                  OPEN
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 24h Timeline Bar ── */}
      <div className="relative flex min-w-[90px] max-w-[160px] flex-1 items-center gap-1.5">
        <span className="terminal-meta-label shrink-0">24H</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
          {/* Session bands */}
          {SESSIONS.map((s) => {
            const on = isOpen(s, utcH);
            const left = (s.openHour / 24) * 100;
            const width = ((s.closeHour - s.openHour) / 24) * 100;
            return (
              <div
                key={s.short}
                className="absolute top-0 h-full rounded-sm transition-opacity duration-500"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: `${s.color}${on ? "55" : "1a"}`,
                }}
              />
            );
          })}
          {/* Cursor */}
          <div
            className="absolute top-0 h-full w-[2px] rounded-full"
            style={{
              left: `${dayPct}%`,
              background: "#d4a11f",
              boxShadow: "0 0 5px rgba(212,161,31,0.8)",
              transform: "translateX(-50%)",
            }}
          />
        </div>
      </div>

      {/* ── Open sessions summary (right-most) ── */}
      {openSessions.length > 0 && (
        <div className="ml-3 shrink-0 hidden md:flex items-center gap-1">
          <span className="terminal-meta-label">ACTIVE</span>
          <span className="text-[10px] font-semibold" style={{ color: openSessions[0].color }}>
            {openSessions.map((s) => s.name).join(" + ")}
          </span>
        </div>
      )}
    </div>
  );
}
