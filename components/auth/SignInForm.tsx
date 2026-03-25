"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { apiFetch } from "@/lib/api-client";
import { connectWalletByLabel, type SupportedWalletLabel } from "@/lib/wallet-connect";
import Link from "next/link";
import { X } from "lucide-react";

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
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletLabel, setWalletLabel] = useState<SupportedWalletLabel>("MetaMask");

  async function handleWalletSignIn() {
    setWalletLoading(true);
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
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950/90 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Sign in with wallet</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Free users can test with live prices + paper trading. DEX and Full unlock live execution.
          </p>
        </div>
        <Link
          href="/terminal"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-zinc-300 transition hover:bg-white/5"
          title="Close"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">Free</p>
          <p className="mt-1 text-[11px] text-zinc-500">$0 / forever</p>
          <p className="mt-2 text-xs text-zinc-400">Live prices, news, paper trading.</p>
        </div>
        <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">DEX</p>
          <p className="mt-1 text-[11px] text-amber-300">$20 / month</p>
          <p className="mt-2 text-xs text-amber-100/90">Hyperliquid + Aster live execution.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">Full</p>
          <p className="mt-1 text-[11px] text-zinc-500">$50 / month</p>
          <p className="mt-2 text-xs text-zinc-400">CEX API integrations + advanced tools.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3 rounded-lg border border-amber-400/25 bg-black/45 p-3">
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
        <p className="text-[11px] text-zinc-500">
          Team access is wallet-based only. <Link href="/pricing" className="text-amber-300 hover:text-amber-200">View plans</Link>.
        </p>
      </div>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
