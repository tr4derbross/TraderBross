import { Suspense } from "react";
import { redirect } from "next/navigation";
import TerminalApp from "@/components/TerminalApp";

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
      <TerminalApp initialTicker={ticker} />
    </Suspense>
  );
}
