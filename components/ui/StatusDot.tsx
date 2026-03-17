"use client";

type Props = { status: "live" | "loading" | "error" | "offline"; size?: number };

export function StatusDot({ status, size = 5 }: Props) {
  const colors = {
    live:    "bg-[var(--color-bull)]",
    loading: "bg-[var(--color-warning-tb)]",
    error:   "bg-[var(--color-bear)]",
    offline: "bg-[var(--color-text-dim)]",
  };
  const pulse =
    status === "live"    ? "pulse-green" :
    status === "loading" ? "pulse-amber" :
    "";
  return (
    <span
      className={`inline-block rounded-full ${colors[status]} ${pulse}`}
      style={{ width: size, height: size }}
    />
  );
}
