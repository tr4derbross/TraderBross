"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useTier } from "@/hooks/useTier";

type Tier2RevenueConfig = {
  hyperliquid: {
    builderEnabled: boolean;
    builderAddress: string;
    feeTenthsBps: number;
  };
  aster: {
    referralEnabled: boolean;
    referralUrl: string;
    asterCodeReady: boolean;
    builderAddress: string;
    builderFeeRate: string;
  };
};

const EMPTY_CONFIG: Tier2RevenueConfig = {
  hyperliquid: {
    builderEnabled: false,
    builderAddress: "",
    feeTenthsBps: 0,
  },
  aster: {
    referralEnabled: false,
    referralUrl: "",
    asterCodeReady: false,
    builderAddress: "",
    builderFeeRate: "",
  },
};

export function useTier2Revenue() {
  const { tier } = useTier();
  const [config, setConfig] = useState<Tier2RevenueConfig>(EMPTY_CONFIG);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const payload = await apiFetch<Tier2RevenueConfig>("/api/revenue/tier2");
        const looksValid =
          payload &&
          typeof payload === "object" &&
          "hyperliquid" in payload &&
          "aster" in payload;
        if (!disposed) setConfig(looksValid ? payload : EMPTY_CONFIG);
      } catch {
        if (!disposed) setConfig(EMPTY_CONFIG);
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, []);

  if (tier === "full") {
    return EMPTY_CONFIG;
  }

  return config;
}
