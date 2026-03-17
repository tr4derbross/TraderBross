"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
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
import { Skeleton } from "@/components/ui/Skeleton";

/* ── Config ─────────────────────────────────────────────────────────────────── */

const CATEGORY_META: Record<
  EventCategory,
  { label: string; icon: React.ReactNode; color: string; border: string }
> = {
  tokenUnlock: {
    label: "Token Unlock",
    icon: <Unlock className="h-3 w-3" />,
    color: "bg-[#FF4D4D]/8 text-[#FF4D4D] border-[#FF4D4D]/20",
    border: "border-l-[#FF4D4D]",
  },
  hardFork: {
    label: "Hard Fork",
    icon: <GitFork className="h-3 w-3" />,
    color: "bg-orange-500/8 text-orange-400 border-orange-500/20",
    border: "border-l-orange-400",
  },
  upgrade: {
    label: "Upgrade",
    icon: <Zap className="h-3 w-3" />,
    color: "bg-[#F2B705]/8 text-[#F2B705] border-[#F2B705]/20",
    border: "border-l-[#F2B705]",
  },
  conference: {
    label: "Conference",
    icon: <Users className="h-3 w-3" />,
    color: "bg-[rgba(242,183,5,0.08)] text-[#F2B705] border-[rgba(242,183,5,0.2)]",
    border: "border-l-[#F2B705]",
  },
  listing: {
    label: "Listing",
    icon: <Plus className="h-3 w-3" />,
    color: "bg-[#4CAF50]/8 text-[#4CAF50] border-[#4CAF50]/20",
    border: "border-l-[#4CAF50]",
  },
  mainnet: {
    label: "Mainnet",
    icon: <Globe className="h-3 w-3" />,
    color: "bg-[rgba(242,183,5,0.06)] text-[#A0A0A0] border-[rgba(242,183,5,0.15)]",
    border: "border-l-[#A0A0A0]",
  },
  regulation: {
    label: "Regulation",
    icon: <Shield className="h-3 w-3" />,
    color: "bg-[rgba(242,183,5,0.08)] text-[#F2B705] border-[rgba(242,183,5,0.2)]",
    border: "border-l-[#F2B705]",
  },
  airdrop: {
    label: "Airdrop",
    icon: <Gift className="h-3 w-3" />,
    color: "bg-pink-500/8 text-pink-400 border-pink-500/20",
    border: "border-l-pink-400",
  },
};

const IMPORTANCE_MAP = {
  high:   "border-[#F2B705]/30 bg-[#F2B705]/10 text-[#F2B705]",
  medium: "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[#A0A0A0]",
  low:    "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-[#6B6B6B]",
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
    day:   "numeric",
    year:  "numeric",
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
    <div
      className={`group relative overflow-hidden rounded-xl border-l-2 border border-[rgba(242,183,5,0.1)] bg-[#121212] transition-all hover:border-[rgba(242,183,5,0.2)] hover:bg-[#1A1A1A] ${meta.border} ${
        isPast ? "opacity-55" : ""
      }`}
    >
      {/* High importance top accent */}
      {event.importance === "high" && !isPast && (
        <div className="absolute right-0 top-0 h-0.5 w-full bg-gradient-to-l from-transparent via-[#F2B705]/40 to-transparent" />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(242,183,5,0.1)] text-[10px] font-bold text-[#F2B705]">
              {event.coinSymbol.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-[#FFFFFF]">
                {event.title}
              </p>
              <p className="text-[10px] text-[#6B6B6B]">{event.coin}</p>
            </div>
          </div>

          {/* Date badge */}
          <div
            className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center ${
              isToday
                ? "border-[#F2B705]/40 bg-[#F2B705]/15 text-[#F2B705]"
                : isSoon
                ? "border-orange-400/30 bg-orange-400/10 text-orange-300"
                : isPast
                ? "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-[#6B6B6B]"
                : "border-[rgba(242,183,5,0.1)] bg-[rgba(242,183,5,0.04)] text-[#A0A0A0]"
            }`}
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.12em]">
              {isToday ? "TODAY" : isPast ? "Past" : `${days}d`}
            </div>
            <div className="text-[10px] font-semibold">{formatDate(event.date)}</div>
          </div>
        </div>

        {/* Description */}
        <p className="mb-3 line-clamp-2 text-[11px] leading-[1.6] text-[#6B6B6B]">
          {event.description}
        </p>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold ${meta.color}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          <span
            className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${IMPORTANCE_MAP[event.importance]}`}
          >
            {event.importance}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {(event.coinSymbol && event.coinSymbol !== "BTC") ||
            event.coin !== "Market-wide" ? (
              <Link
                href={`/terminal?ticker=${event.coinSymbol}`}
                className="flex items-center gap-1 rounded-md border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] px-2 py-0.5 text-[9px] font-bold text-[#F2B705] transition hover:bg-[rgba(242,183,5,0.16)]"
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
                className="text-[#3A3A3A] transition hover:text-[#A0A0A0]"
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
          <CalendarDays className="h-3.5 w-3.5 text-[#F2B705]/60" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B6B6B]">
            {month}
          </span>
        </div>
        <div className="h-px flex-1 bg-[rgba(242,183,5,0.08)]" />
        <span className="text-[10px] text-[#3A3A3A]">{events.length} events</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

const ALL_CATEGORIES: (EventCategory | "all")[] = [
  "all",
  "tokenUnlock",
  "upgrade",
  "conference",
  "hardFork",
  "mainnet",
  "regulation",
  "listing",
  "airdrop",
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
    const key = new Date(e.date).toLocaleDateString("en-US", {
      month: "long",
      year:  "numeric",
    });
    (groups[key] ??= []).push(e);
  }

  const upcoming  = events.filter((e) => daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7);
  const highCount = events.filter((e) => e.importance === "high" && daysUntil(e.date) >= 0).length;

  return (
    <PageWrapper>
      <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Background watermark */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden">
          <img
            src="/Brand/logo.png"
            alt=""
            aria-hidden="true"
            style={{ opacity: 0.04, width: "50%", maxWidth: 600, objectFit: "contain" }}
          />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-6">
            <div className="mb-1 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#F2B705]" />
              <h1 className="text-[15px] font-bold tracking-[-0.01em] text-[#FFFFFF]">
                Crypto Calendar
              </h1>
              {!loading && (
                <span className="rounded-full border border-[rgba(242,183,5,0.2)] bg-[rgba(242,183,5,0.08)] px-2 py-0.5 text-[9px] font-bold text-[#F2B705]">
                  {events.filter((e) => daysUntil(e.date) >= 0).length} upcoming
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6B6B6B]">
              Token unlocks, protocol upgrades, conferences &amp; regulation milestones
            </p>
          </div>

          {/* Stats */}
          {!loading && (
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-[#F2B705]/15 bg-[#F2B705]/5 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#F2B705]/60">
                  Next 7 days
                </div>
                <div className="mt-0.5 font-mono text-[15px] font-bold text-[#F2B705]">
                  {upcoming.length}
                </div>
              </div>
              <div className="rounded-xl border border-[#FF4D4D]/15 bg-[#FF4D4D]/5 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#FF4D4D]/60">
                  High Impact
                </div>
                <div className="mt-0.5 font-mono text-[15px] font-bold text-[#FF4D4D]">
                  {highCount}
                </div>
              </div>
              <div className="rounded-xl border border-[rgba(242,183,5,0.15)] bg-[rgba(242,183,5,0.05)] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#A0A0A0]/60">
                  Token Unlocks
                </div>
                <div className="mt-0.5 font-mono text-[15px] font-bold text-[#A0A0A0]">
                  {events.filter((e) => e.category === "tokenUnlock" && daysUntil(e.date) >= 0).length}
                </div>
              </div>
              <div className="rounded-xl border border-[rgba(242,183,5,0.12)] bg-[rgba(242,183,5,0.04)] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#F2B705]/60">
                  Conferences
                </div>
                <div className="mt-0.5 font-mono text-[15px] font-bold text-[#F2B705]">
                  {events.filter((e) => e.category === "conference" && daysUntil(e.date) >= 0).length}
                </div>
              </div>
            </div>
          )}

          {/* Category filter pills */}
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
                        ? "bg-[rgba(242,183,5,0.16)] text-[#F2B705]"
                        : "text-[#6B6B6B] hover:text-[#A0A0A0]"
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
                showPast
                  ? "bg-[rgba(242,183,5,0.1)] text-[#A0A0A0]"
                  : "text-[#6B6B6B] hover:text-[#A0A0A0]"
              }`}
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform ${showPast ? "rotate-90" : ""}`}
              />
              Show past
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-6">
              {[1, 2].map((g) => (
                <div key={g}>
                  <Skeleton className="mb-3 h-4 w-32 rounded" />
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-36 rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : Object.keys(groups).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-[#6B6B6B]">
              <Calendar className="h-8 w-8 opacity-30" />
              <p className="text-sm">No upcoming events found.</p>
              <p className="text-[11px] text-[#3A3A3A]">
                Check back soon or{" "}
                <a
                  href="https://t.me/traderbross"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#F2B705]/70 transition hover:text-[#F2B705] underline underline-offset-2"
                >
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
    </PageWrapper>
  );
}
