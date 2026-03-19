import { Suspense } from "react";
import TerminalMvpApp from "@/components/TerminalMvpApp";

// Read ticker from ?ticker=ETH and pass to TerminalApp
export default async function TerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  const params = await searchParams;
  const ticker = params.ticker?.toUpperCase();
  return (
    <Suspense fallback={null}>
      <TerminalMvpApp initialTicker={ticker} />
    </Suspense>
  );
}
