"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { connectWalletByLabel, type SupportedWalletLabel } from "@/lib/wallet-connect";

function toHexUtf8(value: string) {
  const encoded = new TextEncoder().encode(value);
  return `0x${Array.from(encoded)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function signWalletMessage(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  address: string,
  message: string,
) {
  const payloadHex = toHexUtf8(message);
  try {
    return String(
      await provider.request({
        method: "personal_sign",
        params: [message, address],
      }),
    );
  } catch {
    try {
      return String(
        await provider.request({
          method: "personal_sign",
          params: [payloadHex, address],
        }),
      );
    } catch {
      return String(
        await provider.request({
          method: "personal_sign",
          params: [address, message],
        }),
      );
    }
  }
}

export default function SignInForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [walletLabel, setWalletLabel] = useState<SupportedWalletLabel>("MetaMask");

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    window.location.href = "/terminal";
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setError("Please enter your email first.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    const redirectTo = `${window.location.origin}/auth/callback?next=/terminal`;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setMessage("Magic link sent. Check your inbox.");
  }

  async function handleWalletSignIn() {
    setWalletLoading(true);
    setMessage("");
    setError("");

    try {
      const session = await connectWalletByLabel(walletLabel);
      if (session.kind !== "evm") {
        throw new Error("Only EVM wallets are supported for sign-in right now.");
      }
      if (!ethers.isAddress(session.address)) {
        throw new Error("Invalid wallet address.");
      }
      const evmProvider = session.provider as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      if (!evmProvider || typeof evmProvider.request !== "function") {
        throw new Error("Wallet provider does not support signing.");
      }

      const noncePayload = await apiFetch<{ ok: boolean; message: string }>("/api/auth/wallet/nonce", {
        method: "POST",
        body: JSON.stringify({ address: session.address }),
      });
      const signature = await signWalletMessage(evmProvider, session.address, noncePayload.message);

      await apiFetch<{
        ok: boolean;
        walletAddress: string;
        tier: "free" | "dex" | "full";
      }>("/api/auth/wallet/verify", {
        method: "POST",
        body: JSON.stringify({
          address: session.address,
          message: noncePayload.message,
          signature,
        }),
      });

      window.location.href = "/terminal";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet sign-in failed.");
    } finally {
      setWalletLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-zinc-950/80 p-6">
      <h1 className="text-xl font-semibold text-white">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Connect wallet to use TraderBross. Team can still use email login.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Plans: Free (news + paper), DEX ($20/mo), Full ($50/mo) - <a href="/pricing" className="text-amber-300 hover:text-amber-200">see pricing</a>.
      </p>

      <div className="mt-5 space-y-3 rounded-lg border border-amber-400/20 bg-black/40 p-3">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Wallet</span>
          <select
            value={walletLabel}
            onChange={(event) => setWalletLabel(event.target.value as SupportedWalletLabel)}
            className="w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
          >
            <option value="MetaMask">MetaMask</option>
            <option value="Rabby">Rabby</option>
            <option value="Coinbase Wallet">Coinbase Wallet</option>
          </select>
        </label>
        <button
          type="button"
          onClick={handleWalletSignIn}
          disabled={walletLoading}
          className="w-full rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {walletLoading ? "Connecting..." : "Sign in with wallet"}
        </button>
      </div>

      <form onSubmit={handlePasswordSignIn} className="mt-4 space-y-3 border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-[0.08em] text-zinc-500">Team login</p>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
            placeholder="Your password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in with password"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading}
        className="mt-3 w-full rounded-md border border-white/20 px-3 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Please wait..." : "Send magic link"}
      </button>

      {message ? <p className="mt-3 text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
