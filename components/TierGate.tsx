"use client";

import type { ReactNode } from "react";
import { Tier, useTier } from "@/hooks/useTier";

interface TierGateProps {
  requires: Tier;
  children: ReactNode;
  fallback?: ReactNode;
}

export function TierGate({ requires, children, fallback }: TierGateProps) {
  const { tier, loading } = useTier();
  const tierOrder: Tier[] = ["free", "dex", "full"];
  const hasAccess = tierOrder.indexOf(tier) >= tierOrder.indexOf(requires);

  if (loading) return null;
  if (hasAccess) return <>{children}</>;
  return fallback ? <>{fallback}</> : <UpgradePrompt requiredTier={requires} />;
}

function UpgradePrompt({ requiredTier }: { requiredTier: Tier }) {
  const plans = {
    dex: { label: "DEX Plan", price: "$20/mo", desc: "Hyperliquid + Aster DEX trading" },
    full: { label: "Full Plan", price: "$50/mo", desc: "CEX + DEX full access" },
  };
  const plan = plans[requiredTier as keyof typeof plans];

  return (
    <div className="tier-gate-overlay">
      <div className="tier-gate-card">
        <span className="tier-gate-lock">🔒</span>
        <h3>{plan?.label} Required</h3>
        <p>{plan?.desc}</p>
        <a href="/pricing" className="tier-gate-btn">
          {plan?.price} — Upgrade
        </a>
      </div>
    </div>
  );
}
