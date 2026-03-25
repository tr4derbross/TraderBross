"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

export type Tier = "free" | "dex" | "full";
const UNLOCK_ALL_TIERS = process.env.NEXT_PUBLIC_UNLOCK_ALL_TIERS === "true";

function normalizeTier(value: unknown): Tier {
  if (value === "dex" || value === "full") return value;
  return "free";
}

export function useTier() {
  if (UNLOCK_ALL_TIERS) {
    return {
      tier: "full" as Tier,
      isAuthenticated: false,
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const resolveTier = async () => {
      if (typeof window !== "undefined") {
        try {
          const walletSession = await apiFetch<{
            authenticated?: boolean;
            tier?: Tier;
            tierExpiresAt?: string | null;
          }>("/api/auth/wallet/session");
          if (walletSession?.authenticated) {
            const expiresAt = walletSession.tierExpiresAt
              ? new Date(walletSession.tierExpiresAt).getTime()
              : null;
          const expired =
              typeof expiresAt === "number" &&
              Number.isFinite(expiresAt) &&
              expiresAt < Date.now();
            if (mounted) {
              setIsAuthenticated(true);
              setTier(expired ? "free" : normalizeTier(walletSession.tier));
              setLoading(false);
            }
            return;
          }
        } catch {
          // ignore wallet session errors and continue
        }

        try {
          const accessState = await apiFetch<{ unlockAllTiers?: boolean }>("/api/site-access");
          if (accessState?.unlockAllTiers) {
          if (mounted) {
            setIsAuthenticated(false);
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
          setIsAuthenticated(false);
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
        setIsAuthenticated(false);
        setTier("free");
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);

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
    return () => {
      mounted = false;
      authListener?.data.subscription.unsubscribe();
    };
  }, [supabase]);

  return {
      tier,
    isAuthenticated,
    isFree: tier === "free",
    isDEX: tier === "dex" || tier === "full",
    isFull: tier === "full",
    canUseDEX: tier === "dex" || tier === "full",
    canUseCEX: tier === "full",
    loading,
  };
}
