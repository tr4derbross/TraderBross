"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import PageWrapper from "@/components/PageWrapper";
import { apiFetch } from "@/lib/api-client";

type PlanId = "dex" | "full";

const PLANS: Record<PlanId, { label: string; tier: "dex" | "full"; fallbackPrice: number }> = {
  dex: { label: "DEX", tier: "dex", fallbackPrice: 20 },
  full: { label: "Full", tier: "full", fallbackPrice: 50 },
};

type WalletSessionPayload = {
  ok?: boolean;
  authenticated?: boolean;
  walletAddress?: string;
  tier?: "free" | "dex" | "full";
  tierExpiresAt?: string | null;
};

type PaymentConfigPayload = {
  ok?: boolean;
  enabled?: boolean;
  receiver?: string | null;
  chainId?: number | null;
  tokenAddress?: string | null;
  tokenDecimals?: number;
  tokenSymbol?: string;
  dexPriceUsd?: number;
  fullPriceUsd?: number;
  txExplorerBaseUrl?: string | null;
};

function parseSafeUnits(value: number, decimals: number) {
  const amount = Number.isFinite(value) && value > 0 ? value : 0;
  return ethers.parseUnits(String(amount), Math.max(0, decimals));
}

async function switchWalletChain(targetChainId: number) {
  const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!ethereum) throw new Error("No EVM wallet provider found.");

  const chainHex = `0x${targetChainId.toString(16)}`;
  const current = String(await ethereum.request({ method: "eth_chainId" }));
  if (current.toLowerCase() === chainHex.toLowerCase()) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex }],
    });
  } catch (error) {
    const code = Number((error as { code?: number })?.code || 0);
    if (code === 4902) {
      throw new Error("Target chain is not added in wallet. Add chain first and retry.");
    }
    throw error;
  }
}

export default function CheckoutClient({ plan }: { plan: PlanId }) {
  const [session, setSession] = useState<WalletSessionPayload | null>(null);
  const [config, setConfig] = useState<PaymentConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const planMeta = PLANS[plan];

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [walletSession, paymentConfig] = await Promise.all([
          apiFetch<WalletSessionPayload>("/api/auth/wallet/session"),
          apiFetch<PaymentConfigPayload>("/api/payments/config"),
        ]);

        if (!active) return;
        setSession(walletSession);
        setConfig(paymentConfig);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load checkout state.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const priceUsd = useMemo(() => {
    if (!config) return planMeta.fallbackPrice;
    return plan === "full" ? Number(config.fullPriceUsd || 50) : Number(config.dexPriceUsd || 20);
  }, [config, plan, planMeta.fallbackPrice]);

  const tokenDecimals = Math.max(0, Number(config?.tokenDecimals || 6) || 6);
  const tokenSymbol = String(config?.tokenSymbol || (config?.tokenAddress ? "USDC" : "ETH"));
  const expectedAmountUnits = parseSafeUnits(priceUsd, tokenDecimals);
  const displayAmount = ethers.formatUnits(expectedAmountUnits, tokenDecimals);

  const canUseWalletPay = Boolean(config?.enabled && config?.receiver && session?.authenticated);

  async function handleVerify() {
    if (!txHash.trim()) {
      setError("Paste transaction hash first.");
      return;
    }
    setVerifying(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch<{
        ok: boolean;
        alreadyProcessed?: boolean;
      }>("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          txHash: txHash.trim(),
          plan,
        }),
      });

      if (response.alreadyProcessed) {
        setMessage("Transaction was already processed for your wallet.");
      } else {
        setMessage(`Payment verified. ${planMeta.label} tier activated.`);
      }
      setTimeout(() => {
        window.location.href = "/terminal";
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  async function handlePayWithWallet() {
    if (!session?.walletAddress) {
      setError("Wallet session is missing. Sign in again.");
      return;
    }
    if (!config?.receiver) {
      setError("Payment receiver is not configured.");
      return;
    }

    setPaying(true);
    setError("");
    setMessage("");

    try {
      const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) {
        throw new Error("No EVM wallet found in browser.");
      }

      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const activeAddress = String(accounts?.[0] || "").toLowerCase();
      if (!activeAddress || activeAddress !== session.walletAddress.toLowerCase()) {
        throw new Error("Active wallet must match signed-in wallet.");
      }

      if (config.chainId) {
        await switchWalletChain(config.chainId);
      }

      const browserProvider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
      const signer = await browserProvider.getSigner();

      let txResponse: ethers.TransactionResponse;
      if (config.tokenAddress) {
        const contract = new ethers.Contract(
          config.tokenAddress,
          ["function transfer(address to, uint256 value) returns (bool)"],
          signer,
        );
        txResponse = await contract.transfer(config.receiver, expectedAmountUnits);
      } else {
        txResponse = await signer.sendTransaction({
          to: config.receiver,
          value: expectedAmountUnits,
        });
      }

      setTxHash(txResponse.hash);
      setMessage("Transaction submitted. Waiting for chain confirmation...");

      await txResponse.wait(1);
      await apiFetch<{ ok: boolean }>("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({ txHash: txResponse.hash, plan }),
      });

      setMessage(`Payment confirmed and ${planMeta.label} tier activated.`);
      setTimeout(() => {
        window.location.href = "/terminal";
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet payment failed.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <PageWrapper>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-24">
        <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f1218] p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">Checkout</p>
          <h1 className="mt-2 text-2xl font-bold text-white">{planMeta.label} Plan</h1>
          <p className="mt-2 text-sm text-zinc-400">
            One-time wallet payment extends your plan for 30 days.
          </p>

          {loading ? <p className="mt-4 text-sm text-zinc-400">Loading checkout...</p> : null}

          {!loading && !session?.authenticated ? (
            <div className="mt-5 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Wallet session not found. <Link href="/sign-in" className="underline">Sign in with wallet</Link> first.
            </div>
          ) : null}

          {!loading ? (
            <div className="mt-5 space-y-2 text-sm text-zinc-300">
              <p>
                Price: <span className="font-semibold text-white">${priceUsd}</span>
              </p>
              <p>
                Pay amount: <span className="font-semibold text-white">{displayAmount} {tokenSymbol}</span>
              </p>
              <p>
                Receiver: <span className="font-mono text-xs text-zinc-200">{config?.receiver || "Not configured"}</span>
              </p>
              <p>
                Chain: <span className="text-zinc-200">{config?.chainId || "Any"}</span>
              </p>
              {session?.walletAddress ? (
                <p>
                  Signed wallet: <span className="font-mono text-xs text-zinc-200">{session.walletAddress}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={!canUseWalletPay || paying}
              onClick={handlePayWithWallet}
              className="w-full rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paying ? "Processing payment..." : `Pay with wallet (${tokenSymbol})`}
            </button>

            <div className="rounded-lg border border-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-zinc-500">Manual verification</p>
              <input
                value={txHash}
                onChange={(event) => setTxHash(event.target.value)}
                placeholder="Paste transaction hash"
                className="mt-2 w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying}
                className="mt-2 w-full rounded-md border border-white/20 px-3 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? "Verifying..." : "Verify transaction"}
              </button>
            </div>
          </div>

          {config?.txExplorerBaseUrl && txHash ? (
            <a
              href={`${config.txExplorerBaseUrl.replace(/\/+$/, "")}/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs text-amber-300 hover:text-amber-200"
            >
              Open transaction in explorer
            </a>
          ) : null}

          {message ? <p className="mt-4 text-sm text-emerald-400">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        </section>
      </main>
    </PageWrapper>
  );
}
