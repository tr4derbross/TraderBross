"use client";

interface EmptyStateProps {
  message?: string;
  icon?: string;
  className?: string;
}

export function EmptyState({
  message = "No data available",
  icon = "—",
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
      <span className="text-2xl mb-2 opacity-30">{icon}</span>
      <p className="text-[#555] text-xs font-mono tracking-wider">{message}</p>
    </div>
  );
}

export function EmptyOrderBook() {
  return <EmptyState message="Waiting for order book data..." icon="📊" />;
}

export function EmptyNewsFeed() {
  return <EmptyState message="No items matching filters" icon="📰" />;
}

export function EmptyWalletConnect() {
  return <EmptyState message="Connect wallet to trade" icon="🔗" />;
}

export function EmptyWhales() {
  return <EmptyState message="No whale alerts yet" icon="🐋" />;
}

export function EmptyLiquidations() {
  return <EmptyState message="No liquidations in last 5 min" icon="💥" />;
}
