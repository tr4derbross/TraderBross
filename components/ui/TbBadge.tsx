import React from "react";

type Variant = "bull" | "bear" | "break" | "neut" | "whale" | "paper" | "info";
type Props = { variant: Variant; children: React.ReactNode; className?: string };

const styles: Record<Variant, string> = {
  bull:  "bg-[var(--color-bull-bg)]  text-[var(--color-bull)]  border-[var(--color-bull-dim)]/30",
  bear:  "bg-[var(--color-bear-bg)]  text-[var(--color-bear)]  border-[var(--color-bear-dim)]/30",
  break: "bg-[var(--color-bear-bg)]  text-[var(--color-bear)]  border-[var(--color-bear-dim)]/30",
  neut:  "bg-[var(--color-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-tb)]",
  whale: "bg-[var(--color-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-tb)]",
  paper: "bg-[var(--color-warning-bg-tb)] text-[var(--color-warning-tb)] border-[var(--color-warning-tb)]/30",
  info:  "bg-[var(--color-accent-bg-tb)] text-[var(--color-accent-tb)] border-[var(--color-accent-tb)]/30",
};

export function TbBadge({ variant, children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] uppercase font-mono rounded ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
