/**
 * TraderBross — Shared formatting utilities
 * formatCompact: 1_500_000 → "$1.5M"
 * timeAgo: Date → "2s ago" / "4m ago"
 */

/** Format a USD value as compact notation: $1.5M, $320K, etc. */
export function formatCompact(n: number): string {
  if (!n || isNaN(n)) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/** Format a raw token amount compactly (no $ prefix) */
export function formatTokenAmount(n: number, decimals = 4): string {
  if (!n || isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n >= 1 ? n.toFixed(2) : n.toFixed(decimals);
}

/** Relative time: "just now", "4s ago", "12m ago", "2h ago" */
export function timeAgo(date: Date | string | number): string {
  const ts = date instanceof Date ? date.getTime() : typeof date === "number" ? date : new Date(date).getTime();
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/** Format price with appropriate decimal places */
export function formatPrice(price: number): string {
  if (price >= 10_000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1_000) return price.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}
