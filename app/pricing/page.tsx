import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceLabel: "Forever Free",
    cta: "Start Free",
    ctaLink: "/sign-in",
    highlight: false,
    features: [
      "Real-time news feed (CoinDesk, Cointelegraph, Decrypt)",
      "Exchange announcements (Binance, Bybit, OKX)",
      "5-exchange live price ticker",
      "Paper trading (unlimited simulations)",
      "Funding rate tracker",
      "Liquidation monitor",
    ],
    locked: [],
  },
  {
    id: "dex",
    name: "DEX",
    price: 20,
    priceLabel: "$20 / month",
    cta: "Get DEX Plan",
    ctaLink: "/checkout?plan=dex",
    highlight: true,
    features: [
      "Everything in Free",
      "Hyperliquid perpetuals trading",
      "Aster DEX trading ($1.32B daily volume)",
      "DEX wallet connect (MetaMask / WalletConnect)",
      "Real order execution",
      "No KYC required",
    ],
    locked: ["CEX API keys"],
  },
  {
    id: "full",
    name: "Full",
    price: 50,
    priceLabel: "$50 / month",
    cta: "Get Full Plan",
    ctaLink: "/checkout?plan=full",
    highlight: false,
    features: [
      "Everything in DEX",
      "Binance API integration",
      "Bybit API integration",
      "OKX API integration",
      "Advanced screener",
      "Full funding rate arbitrage tools",
    ],
    locked: [],
  },
] as const;

export default function PricingPage() {
  return (
    <PageWrapper>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24">
        <div className="mb-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">TraderBross Plans</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Choose your trading access tier</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => (
            <section
              key={tier.id}
              className={`rounded-2xl border p-5 ${
                tier.highlight
                  ? "border-amber-300/40 bg-amber-500/5"
                  : "border-[rgba(255,255,255,0.08)] bg-[#0f1218]"
              }`}
            >
              <p className="text-sm font-semibold text-zinc-200">{tier.name}</p>
              <p className="mt-2 text-2xl font-bold text-white">{tier.priceLabel}</p>
              <Link
                href={tier.ctaLink}
                className="mt-4 inline-flex rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black"
              >
                {tier.id === "free" ? "Start Free - No credit card" : tier.cta}
              </Link>
              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                {tier.features.map((feature) => (
                  <li key={feature}>- {feature}</li>
                ))}
              </ul>
              {tier.locked.length > 0 ? (
                <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  Locked: {tier.locked.join(", ")}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </main>
    </PageWrapper>
  );
}
