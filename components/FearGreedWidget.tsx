"use client";

import { useFearGreed, fgColor, fgEmoji } from "@/hooks/useFearGreed";

interface FearGreedWidgetProps {
  compact?: boolean; // header pill mode
}

function Arc({ value }: { value: number }) {
  // Half-circle gauge using SVG
  const r = 28;
  const cx = 36;
  const cy = 36;
  const circumference = Math.PI * r; // half-circle arc length
  const offset = circumference - (value / 100) * circumference;
  const color = fgColor(value);

  return (
    <svg width="72" height="40" viewBox="0 0 72 42" className="overflow-visible">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#27272a"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={`${offset}`}
        style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease" }}
      />
      {/* Value text */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fill={color}
        fontSize="13"
        fontWeight="700"
        fontFamily="monospace"
      >
        {value}
      </text>
    </svg>
  );
}

/** Full widget — used in a side panel or card */
export function FearGreedCard() {
  const { data, loading } = useFearGreed();

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 p-3 flex flex-col gap-2 items-center">
        <div className="skeleton-shimmer h-10 w-20 rounded" />
        <div className="skeleton-shimmer h-3 w-24 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const color = fgColor(data.value);
  const emoji = fgEmoji(data.label);

  return (
    <div className="rounded-xl border border-zinc-800 p-3 flex flex-col gap-1 items-center panel-fade-in">
      <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
        Fear &amp; Greed Index
      </p>

      <Arc value={data.value} />

      <p className="text-[11px] font-bold" style={{ color }}>
        {emoji} {data.label}
      </p>

      {/* 7-day sparkline */}
      {data.history.length > 0 && (
        <div className="flex items-end gap-0.5 h-5 mt-1">
          {[...data.history].reverse().map((h, i) => (
            <div
              key={i}
              title={`${h.value} — ${h.label}`}
              className="w-2 rounded-sm transition-all"
              style={{
                height: `${Math.max(4, (h.value / 100) * 20)}px`,
                background: fgColor(h.value),
                opacity: 0.7 + (i / data.history.length) * 0.3,
              }}
            />
          ))}
        </div>
      )}

      <p className="text-[9px] text-zinc-600 mt-0.5">7-day history</p>
    </div>
  );
}

/** Compact pill for terminal header */
export function FearGreedPill({ compact = false }: FearGreedWidgetProps) {
  const { data, loading } = useFearGreed();

  if (loading) {
    return <div className="skeleton-shimmer h-5 w-16 rounded-full" />;
  }
  if (!data) return null;

  const color = fgColor(data.value);
  const emoji = fgEmoji(data.label);

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-default select-none"
      style={{ borderColor: `${color}40`, background: `${color}10`, color }}
      title={`Fear & Greed: ${data.value} — ${data.label}`}
    >
      <span>{emoji}</span>
      <span>{data.value}</span>
      {!compact && <span className="opacity-70">{data.label}</span>}
    </div>
  );
}
