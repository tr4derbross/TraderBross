"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

export type Tier = "free" | "dex" | "full";

function normalizeTier(value: unknown): Tier {
  if (value === "dex" || value === "full") return value;
  return "free";
}

export function useTier() {
  const supabase = useMemo(
    () => (hasSupabasePublicEnv() ? createSupabaseBrowserClient() : null),
    [],
  );
  const [tier, setTier] = useState<Tier>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const resolveTier = async () => {
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

    return () => {
      mounted = false;
      authListener?.data.subscription.unsubscribe();
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
