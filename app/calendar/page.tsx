"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import type { CalendarEvent, EventCategory } from "@/app/api/calendar/route";
import {
  Calendar,
  CalendarDays,
  Unlock,
  GitFork,
  Zap,
  Users,
  Plus,
  Globe,
  Shield,
  Gift,
  ExternalLink,
  LayoutDashboard,
  ChevronRight,
} from "lucide-react";

/* ── Config ─────────────────────────────────────────────────────────────────── */

const CATEGORY_META: Record<EventCategory, { label: string; icon: React.ReactNode; color: string }> = {
  tokenUnlock: { label: "Token Unlock", icon: <Unlock className="h-3 w-3" />, color: "rose" },
  hardFork:    { label: "Hard Fork",    icon: <GitFork className="h-3 w-3" />, color: "orange" },
  upgrade:     { label: "Upgrade",      icon: <Zap className="h-3 w-3" />,     color: "amber" },
  conference:  { label: "Conference",   icon: <Users className="h-3 w-3" />,   color: "sky" },
  listing:     { label: "Listing",      icon: <Plus className="h-3 w-3" />,    color: "emerald" },
  mainnet:     { label: "Mainnet",      icon: <Globe className="h-3 w-3" />,   color: "violet" },
  regulation:  { label: "Regulation",   icon: <Shield className="h-3 w-3" />,  color: "zinc" },
  airdrop:     { label: "Airdrop",      icon: <Gift className="h-3 w-3" />,    color: "pink" },
};

const COLOR_MAP: Record<string, string> = {
  rose:    "border-rose-400/20 bg-rose-400/8 text-rose-300",
  orange:  "border-orange-400/20 bg-orange-400/8 text-orange-300",
  amber:   "border-amber-400/20 bg-amber-400/8 text-amber-300",
  sky:     "border-sky-400/20 bg-sky-400/8 text-sky-300",
  emerald: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300",
  violet:  "border-violet-400/20 bg-violet-400/8 text-violet-300",
  zinc:    "border-zinc-400/20 bg-zinc-400/8 text-zinc-300",
  pink:    "border-pink-400/20 bg-pink-400/8 text-pink-300",
};

const IMPORTANCE_MAP = {
  high:   "border-amber-500/30 bg-amber-500/10 text-amber-300",
  medium: "border-zinc-500/20 bg-zinc-500/8 text-zinc-400",
  low:    "border-zinc-700/20 bg-zinc-700/8 text-zinc-600",
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now    = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Event Card ──────────────────────────────────────────────────────────────── */

function EventCard({ event }: { event: CalendarEvent }) {
  const meta    = CATEGORY_META[event.category];
  const days    = daysUntil(event.date);
  const isPast  = days < 0;
  const isToday = days === 0;
  const isSoon  = days > 0 && days <= 7;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border transition-all hover:border-[rgba(212,161,31,0.2)] hover:bg-[rgba(255,255,255,0.025)] ${
      isPast ? "border-[rgba(255,255,255,0.04)] opacity-60" : "border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.015)]"
    }`}>
      {/* Importance accent */}
      {event.importance === "high" && !isPast && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl bg-gradient-to-b from-amber-400/60 to-transparent" />
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Coin avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(212,161,31,0.12)] text-[10px] font-bold text-amber-300">
              {event.coinSymbol.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-[#e8dfc8]">{event.title}</p>
              <p className="text-[10px] text-zinc-500">{event.coin}</p>
            </div>
          </div>

          {/* Date badge */}
          <div className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-center ${
            isToday ? "border-amber-400/40 bg-amber-400/15 text-amber-300" :
            isSoon  ? "border-orange-400/30 bg-orange-400/10 text-orange-300" :
            isPast  ? "border-zinc-700/30 bg-zinc-800/30 text-zinc-600" :
                      "border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-zinc-400"
          }`}>
            <div className="text-[9px] font-bold uppercase tracking-[0.12em]">
              {isToday ? "TODAY" : isPast ? "Past" : `${days}d`}
            </div>
            <div className="text-[10px] font-semibold">{formatDate(event.date)}</div>
          </div>
        </div>

        {/* Description */}
        <p className="mb-3 line-clamp-2 text-[11px] leading-[1.6] text-zinc-500">
          {event.description}
        </p>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold ${COLOR_MAP[meta.color]}`}>
            {meta.icon}
            {meta.label}
          </span>
          <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${IMPORTANCE_MAP[event.importance]}`}>
            {event.importance}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {event.coinSymbol && event.coinSymbol !== "BTC" || event.coin !== "Market-wide" ? (
              <Link
                href={`/terminal?ticker=${event.coinSymbol}`}
                className="flex items-center gap-1 rounded-md border border-[rgba(212,161,31,0.18)] bg-[rgba(212,161,31,0.06)] px-2 py-0.5 text-[9px] font-bold text-amber-400 transition hover:bg-[rgba(212,161,31,0.14)]"
              >
                <LayoutDashboard className="h-2.5 w-2.5" />
                Trade
              </Link>
            ) : null}
            {event.source && event.source.startsWith("http") && (
              <a
                href={event.source}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-700 transition hover:text-zinc-400"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Timeline group ──────────────────────────────────────────────────────────── */

function MonthGroup({ month, events }: { month: string; events: CalendarEvent[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-amber-400/60" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{month}</span>
        </div>
        <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
        <span className="text-[10px] text-zinc-700">{events.length} events</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((e) => <EventCard key={e.id} event={e} />)}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

const ALL_CATEGORIES: (EventCategory | "all")[] = [
  "all", "tokenUnlock", "upgrade", "conference", "hardFork", "mainnet", "regulation", "listing", "airdrop",
];

export default function CalendarPage() {
  const [events, setEvents]       = useState<CalendarEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [catFilter, setCatFilter] = useState<EventCategory | "all">("all");
  const [showPast, setShowPast]   = useState(false);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data: CalendarEvent[]) => setEvents(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = events
    .filter((e) => catFilter === "all" || e.category === catFilter)
    .filter((e) => showPast || daysUntil(e.date) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Group by month
  const groups: Record<string, CalendarEvent[]> = {};
  for (const e of filtered) {
    const key = new Date(e.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    (groups[key] ??= []).push(e);
  }

  const upcoming = events.filter((e) => daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7);
  const highCount = events.filter((e) => e.importance === "high" && daysUntil(e.date) >= 0).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#07060a] text-[var(--text-primary)]">
      <SiteNav />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-400" />
            <h1 className="text-[15px] font-bold tracking-[-0.01em] text-[#f0e8d3]">Crypto Calendar</h1>
            {!loading && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                {events.filter((e) => daysUntil(e.date) >= 0).length} upcoming
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-600">
            Token unlocks, protocol upgrades, conferences &amp; regulation milestones
          </p>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-amber-300/60">Next 7 days</div>
              <div className="mt-0.5 font-mono text-[15px] font-bold text-amber-300">{upcoming.length}</div>
            </div>
            <div className="rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-rose-300/60">High Impact</div>
              <div className="mt-0.5 font-mono text-[15px] font-bold text-rose-300">{highCount}</div>
            </div>
            <div className="rounded-xl border border-violet-400/15 bg-violet-400/5 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-violet-300/60">Token Unlocks</div>
              <div className="mt-0.5 font-mono text-[15px] font-bold text-violet-300">
                {events.filter((e) => e.category === "tokenUnlock" && daysUntil(e.date) >= 0).length}
              </div>
            </div>
            <div className="rounded-xl border border-sky-400/15 bg-sky-400/5 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-sky-300/60">Conferences</div>
              <div className="mt-0.5 font-mono text-[15px] font-bold text-sky-300">
                {events.filter((e) => e.category === "conference" && daysUntil(e.date) >= 0).length}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {ALL_CATEGORIES.map((cat) => {
              const meta = cat === "all" ? null : CATEGORY_META[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${
                    catFilter === cat
                      ? "bg-[rgba(212,161,31,0.16)] text-amber-200"
                      : "text-zinc-600 hover:text-zinc-300"
                  }`}
                >
                  {meta?.icon}
                  {cat === "all" ? "All" : meta?.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowPast((p) => !p)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${
              showPast ? "bg-zinc-700/40 text-zinc-300" : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${showPast ? "rotate-90" : ""}`} />
            Show past
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2].map((g) => (
              <div key={g}>
                <div className="skeleton-shimmer mb-3 h-4 w-32 rounded" />
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-36 rounded-2xl border border-[rgba(255,255,255,0.06)] skeleton-shimmer" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(groups).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-600">
            <Calendar className="h-8 w-8 opacity-30" />
            <p className="text-sm">No upcoming events found.</p>
            <p className="text-[11px] text-zinc-700">
              Check back soon or{" "}
              <a href="https://t.me/traderbross" target="_blank" rel="noreferrer" className="text-amber-500/70 hover:text-amber-400 transition underline underline-offset-2">
                join our Telegram
              </a>{" "}
              for live updates.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([month, evts]) => (
              <MonthGroup key={month} month={month} events={evts} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
