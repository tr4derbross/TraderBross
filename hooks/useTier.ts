"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

export type Tier = "free" | "dex" | "full";
const TIER_OVERRIDE_STORAGE_KEY = "traderbross.tier-override.v1";
const UNLOCK_ALL_TIERS = process.env.NEXT_PUBLIC_UNLOCK_ALL_TIERS === "true";

function normalizeTier(value: unknown): Tier {
  if (value === "dex" || value === "full") return value;
  return "free";
}

export function useTier() {
  if (UNLOCK_ALL_TIERS) {
    return {
      tier: "full" as Tier,
      isFree: false,
      isDEX: true,
      isFull: true,
      canUseDEX: true,
      canUseCEX: true,
      loading: false,
    };
  }

  const supabase = useMemo(
    () => (hasSupabasePublicEnv() ? createSupabaseBrowserClient() : null),
    [],
  );
  const [tier, setTier] = useState<Tier>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const resolveTier = async () => {
      if (typeof window !== "undefined") {
        const overrideTier = sessionStorage.getItem(TIER_OVERRIDE_STORAGE_KEY);
        if (overrideTier) {
          if (mounted) {
            setTier(normalizeTier(overrideTier));
            setLoading(false);
          }
          return;
        }

        try {
          const accessState = await apiFetch<{ unlockAllTiers?: boolean }>("/api/site-access");
          if (accessState?.unlockAllTiers) {
            if (mounted) {
              setTier("full");
              setLoading(false);
            }
            return;
          }
        } catch {
          // ignore and continue to normal tier resolution
        }
      }

      if (!supabase) {
        if (mounted) {
          setTier("free");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (!user) {
        setTier("free");
        setLoading(false);
        return;
      }

      const now = Date.now();

      try {
        const profileQuery = await supabase
          .from("profiles")
          .select("tier, tier_expires_at")
          .eq("id", user.id)
          .maybeSingle();

        if (profileQuery.data) {
          const expiresAt = profileQuery.data.tier_expires_at
            ? new Date(profileQuery.data.tier_expires_at).getTime()
            : null;
          const expired = typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt < now;
          setTier(expired ? "free" : normalizeTier(profileQuery.data.tier));
          setLoading(false);
          return;
        }
      } catch {
        // fall through to subscriptions fallback
      }

      try {
        const subsQuery = await supabase
          .from("subscriptions")
          .select("tier, expires_at")
          .eq("user_id", user.id)
          .maybeSingle();
        const expiresAt = subsQuery.data?.expires_at ? new Date(subsQuery.data.expires_at).getTime() : null;
        const expired = typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt < now;
        setTier(expired ? "free" : normalizeTier(subsQuery.data?.tier));
      } catch {
        setTier("free");
      } finally {
        setLoading(false);
      }
    };

    void resolveTier();

    const authListener = supabase?.auth.onAuthStateChange(() => {
      void resolveTier();
    });
    const handleTierOverrideChanged = () => {
      void resolveTier();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("tier-override-changed", handleTierOverrideChanged);
    }

    return () => {
      mounted = false;
      authListener?.data.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("tier-override-changed", handleTierOverrideChanged);
      }
    };
  }, [supabase]);

  return {
    tier,
    isFree: tier === "free",
    isDEX: tier === "dex" || tier === "full",
    isFull: tier === "full",
    canUseDEX: tier === "dex" || tier === "full",
    canUseCEX: tier === "full",
    loading,
  };
}
