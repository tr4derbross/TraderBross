"use client";

/** Shimmer skeleton for loading states */
export function SkeletonLine({
  width = "100%",
  height = 10,
  className = "",
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonNewsCard() {
  return (
    <div className="border-b border-[rgba(212,161,31,0.06)] px-3 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <SkeletonLine width={60} height={8} />
        <SkeletonLine width={40} height={8} />
        <SkeletonLine width={30} height={8} />
      </div>
      <SkeletonLine height={12} className="mb-1.5" />
      <SkeletonLine width="75%" height={12} className="mb-2.5" />
      <div className="flex gap-1.5">
        <SkeletonLine width={36} height={18} className="rounded-full" />
        <SkeletonLine width={36} height={18} className="rounded-full" />
      </div>
    </div>
  );
}

export function NewsFeedSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonNewsCard key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-full flex-col animate-in fade-in duration-300">
      {/* Fake toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[rgba(212,161,31,0.08)] px-3 py-2">
        <SkeletonLine width={80} height={10} />
        <SkeletonLine width={60} height={10} />
        <div className="ml-auto flex gap-1.5">
          {[30, 24, 28, 24, 28, 30, 24].map((w, i) => (
            <SkeletonLine key={i} width={w} height={22} className="rounded-lg" />
          ))}
        </div>
      </div>
      {/* Fake price area */}
      <div className="flex min-h-0 flex-1 items-end gap-px px-4 pb-6 pt-4">
        {Array.from({ length: 42 }).map((_, i) => {
          const h = 20 + Math.abs(Math.sin(i * 0.7 + 1.2) * 55 + Math.cos(i * 0.3) * 25);
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-px">
              <div
                className="skeleton-shimmer w-full rounded-sm opacity-60"
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-3 animate-in fade-in duration-300">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <SkeletonLine width="35%" height={8} />
          <SkeletonLine height={32} className="rounded-xl" />
        </div>
      ))}
    </div>
  );
}
