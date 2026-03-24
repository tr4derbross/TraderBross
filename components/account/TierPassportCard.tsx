"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Tier } from "@/hooks/useTier";

const TIER_PASSPORT_STORAGE_KEY = "traderbross.tier-passport.v1";

type PassportResponse = {
  ok: boolean;
  tier: Tier;
  token: string;
  expiresAt: string;
};

type ValidateResponse = {
  ok: boolean;
  tier: Tier;
  expiresAt: string;
};

export default function TierPassportCard() {
  const [code, setCode] = useState("");
  const [activeTier, setActiveTier] = useState<Tier | null>(null);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshStatus = async () => {
    const token = sessionStorage.getItem(TIER_PASSPORT_STORAGE_KEY);
    if (!token) {
      setActiveTier(null);
      setExpiresAt("");
      return;
    }
    try {
      const data = await apiFetch<ValidateResponse>(
        `/api/admin/tier-passport?token=${encodeURIComponent(token)}`,
      );
      if (data?.ok) {
        setActiveTier(data.tier);
        setExpiresAt(data.expiresAt);
        return;
      }
      setActiveTier(null);
      setExpiresAt("");
    } catch {
      sessionStorage.removeItem(TIER_PASSPORT_STORAGE_KEY);
      setActiveTier(null);
      setExpiresAt("");
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const issuePassport = async (tier: Tier) => {
    if (!code.trim()) {
      setMessage("Passport code required.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const data = await apiFetch<PassportResponse>("/api/admin/tier-passport", {
        method: "POST",
        body: JSON.stringify({ code: code.trim(), tier }),
      });
      sessionStorage.setItem(TIER_PASSPORT_STORAGE_KEY, data.token);
      setActiveTier(data.tier);
      setExpiresAt(data.expiresAt);
      setMessage(`${data.tier.toUpperCase()} passport activated.`);
      window.dispatchEvent(new Event("tier-passport-changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passport activation failed.");
    } finally {
      setLoading(false);
    }
  };

  const clearPassport = () => {
    sessionStorage.removeItem(TIER_PASSPORT_STORAGE_KEY);
    setActiveTier(null);
    setExpiresAt("");
    setMessage("Passport cleared. Live tier read restored.");
    window.dispatchEvent(new Event("tier-passport-changed"));
  };

  return (
    <section className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/5 p-5">
      <h2 className="text-sm font-semibold text-amber-200">Tier Passport (Prelaunch Admin)</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Temporary local override for tier testing. Does not mutate Supabase subscriptions.
      </p>

      <div className="mt-3">
        <input
          type="password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter admin passport code"
          className="w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => issuePassport("free")}
          disabled={loading}
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
        >
          Activate FREE
        </button>
        <button
          type="button"
          onClick={() => issuePassport("dex")}
          disabled={loading}
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
        >
          Activate DEX
        </button>
        <button
          type="button"
          onClick={() => issuePassport("full")}
          disabled={loading}
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
        >
          Activate FULL
        </button>
        <button
          type="button"
          onClick={clearPassport}
          disabled={loading}
          className="rounded-md border border-rose-400/30 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-50"
        >
          Clear Passport
        </button>
      </div>

      <div className="mt-3 text-xs text-zinc-300">
        Active: {activeTier ? activeTier.toUpperCase() : "None"}
        {expiresAt ? ` · Expires: ${new Date(expiresAt).toLocaleString()}` : ""}
      </div>
      {message ? <p className="mt-2 text-xs text-amber-200">{message}</p> : null}
    </section>
  );
}
