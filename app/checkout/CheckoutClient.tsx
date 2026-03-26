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

type PaymentNetworkOption = {
  id: string;
  label?: string | null;
  enabled?: boolean;
  receiver?: string | null;
  chainId?: number | null;
  tokenAddress?: string | null;
  tokenDecimals?: number;
  tokenSymbol?: string | null;
  txExplorerBaseUrl?: string | null;
  tokenAllowed?: boolean;
};

type PaymentConfigPayload = {
  ok?: boolean;
  enabled?: boolean;
  defaultNetworkId?: string | null;
  networks?: PaymentNetworkOption[];
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

const CHECKOUT_NETWORK_STORAGE_KEY = "traderbross.checkout.network.v1";

function enabledNetworks(config: PaymentConfigPayload | null | undefined) {
  return (config?.networks || []).filter((network) => network?.id && network?.enabled);
}

async function detectWalletChainId() {
  try {
    const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!ethereum) return null;
    const raw = String(await ethereum.request({ method: "eth_chainId" }));
    const value = Number.parseInt(raw, 16);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function resolveInitialNetworkId(config: PaymentConfigPayload | null | undefined) {
  const enabled = enabledNetworks(config);
  if (enabled.length === 0) return String(config?.defaultNetworkId || "default");

  const walletChainId = await detectWalletChainId();
  if (walletChainId) {
    const sameChain = enabled.filter((network) => Number(network.chainId || 0) === walletChainId);
    if (sameChain.length > 0) {
      const preferredUsdt = sameChain.find(
        (network) => String(network.tokenSymbol || "").trim().toUpperCase() === "USDT",
      );
      if (preferredUsdt) return preferredUsdt.id;
      try {
        const saved = String(localStorage.getItem(CHECKOUT_NETWORK_STORAGE_KEY) || "");
        if (saved && sameChain.some((network) => network.id === saved)) {
          return saved;
        }
      } catch {
        // ignore storage errors
      }
      const preferred = sameChain.find((network) => network.id === config?.defaultNetworkId);
      return preferred?.id || sameChain[0].id;
    }
  }

  try {
    const saved = String(localStorage.getItem(CHECKOUT_NETWORK_STORAGE_KEY) || "");
    if (saved && enabled.some((network) => network.id === saved)) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }

  const defaultEnabled = enabled.find((network) => network.id === config?.defaultNetworkId);
  if (defaultEnabled) return defaultEnabled.id;
  return enabled[0].id;
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

function parseWalletPaymentError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "Wallet payment failed.");
  const msg = raw.toLowerCase();
  if (
    msg.includes("exceeds balance") ||
    msg.includes("insufficient funds") ||
    msg.includes("transfer amount exceeds")
  ) {
    return "Insufficient token balance for this payment amount.";
  }
  if (msg.includes("user rejected") || msg.includes("rejected the request")) {
    return "Transaction was rejected in wallet.";
  }
  if (msg.includes("target chain is not added")) {
    return "Selected network is not added in wallet. Add chain first and retry.";
  }
  return raw;
}

export default function CheckoutClient({ plan }: { plan: PlanId }) {
  const [session, setSession] = useState<WalletSessionPayload | null>(null);
  const [config, setConfig] = useState<PaymentConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [selectedNetworkId, setSelectedNetworkId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

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
        setWalletChainId(await detectWalletChainId());
        setSelectedNetworkId(await resolveInitialNetworkId(paymentConfig));
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ethereum = (window as Window & {
      ethereum?: {
        on?: (event: string, listener: (payload: unknown) => void) => void;
        removeListener?: (event: string, listener: (payload: unknown) => void) => void;
      };
    }).ethereum;
    if (!ethereum?.on || !ethereum?.removeListener) return;

    const handleChainChanged = (payload: unknown) => {
      const raw = String(payload || "");
      const parsed = Number.parseInt(raw, 16);
      setWalletChainId(Number.isFinite(parsed) ? parsed : null);
    };

    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    if (!selectedNetworkId) return;
    try {
      localStorage.setItem(CHECKOUT_NETWORK_STORAGE_KEY, selectedNetworkId);
    } catch {
      // ignore storage errors
    }
  }, [selectedNetworkId]);

  const priceUsd = useMemo(() => {
    if (!config) return planMeta.fallbackPrice;
    return plan === "full" ? Number(config.fullPriceUsd || 50) : Number(config.dexPriceUsd || 20);
  }, [config, plan, planMeta.fallbackPrice]);

  const configuredNetworks = (config?.networks || []).filter((network) => network?.id);
  const selectableNetworks = configuredNetworks.filter((network) => network?.enabled);
  const fallbackNetwork = {
    id: String(config?.defaultNetworkId || "default"),
    label: "Default",
    enabled: config?.enabled,
    receiver: config?.receiver || null,
    chainId: config?.chainId || null,
    tokenAddress: config?.tokenAddress || null,
    tokenDecimals: config?.tokenDecimals || 6,
    tokenSymbol: config?.tokenSymbol || null,
    txExplorerBaseUrl: config?.txExplorerBaseUrl || null,
    tokenAllowed: false,
  };
  const activeNetwork =
    selectableNetworks.find((network) => network.id === selectedNetworkId) ||
    selectableNetworks.find((network) => network.id === config?.defaultNetworkId) ||
    selectableNetworks[0] ||
    configuredNetworks.find((network) => network.id === selectedNetworkId) ||
    configuredNetworks.find((network) => network.id === config?.defaultNetworkId) ||
    configuredNetworks[0] ||
    fallbackNetwork;

  const tokenDecimals = Math.max(0, Number(activeNetwork?.tokenDecimals || 6) || 6);
  const tokenSymbol = String(activeNetwork?.tokenSymbol || "").trim().toUpperCase();
  const stableSymbol = tokenSymbol === "USDC" || tokenSymbol === "USDT" ? tokenSymbol : "";
  const tokenAllowed = Boolean(activeNetwork?.tokenAllowed);
  const expectedAmountUnits = parseSafeUnits(priceUsd, tokenDecimals);
  const displayAmount = ethers.formatUnits(expectedAmountUnits, tokenDecimals);
  const paymentReady = Boolean(
      activeNetwork?.enabled &&
      activeNetwork?.receiver &&
      activeNetwork?.tokenAddress &&
      tokenAllowed &&
      stableSymbol &&
      activeNetwork?.chainId,
  );

  const canUseWalletPay = Boolean(paymentReady && session?.authenticated);
  const walletConnected = Boolean(session?.authenticated && session?.walletAddress);
  const walletChainMismatch = Boolean(
    walletChainId &&
      activeNetwork?.chainId &&
      Number(walletChainId) !== Number(activeNetwork.chainId),
  );
  const walletChainSupported = Boolean(
    walletChainId &&
      selectableNetworks.some((network) => Number(network.chainId || 0) === Number(walletChainId)),
  );

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
          networkId: activeNetwork.id,
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

  async function executeWalletPayment() {
    if (!session?.walletAddress) {
      setError("Wallet session is missing. Sign in again.");
      return;
    }
    if (!activeNetwork?.receiver) {
      setError("Payment receiver is not configured.");
      return;
    }
    if (!activeNetwork?.tokenAddress || !stableSymbol) {
      setError("Payment token is not configured as USDC/USDT.");
      return;
    }
    if (!tokenAllowed) {
      setError("Payment token contract is not in the allowlist.");
      return;
    }
    if (!activeNetwork?.chainId) {
      setError("Payment chain is not configured.");
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

      if (activeNetwork.chainId) {
        await switchWalletChain(activeNetwork.chainId);
        setWalletChainId(activeNetwork.chainId);
      }

      const browserProvider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
      const signer = await browserProvider.getSigner();
      const signerAddress = await signer.getAddress();

      const nativeBalance = await browserProvider.getBalance(signerAddress);
      if (nativeBalance <= BigInt(0)) {
        throw new Error("Insufficient native gas balance for transaction fees.");
      }

      const contract = new ethers.Contract(
        activeNetwork.tokenAddress,
        [
          "function transfer(address to, uint256 value) returns (bool)",
          "function balanceOf(address account) view returns (uint256)",
        ],
        signer,
      );
      const tokenBalance = (await contract.balanceOf(signerAddress)) as bigint;
      if (tokenBalance < expectedAmountUnits) {
        throw new Error("Insufficient token balance for this payment amount.");
      }
      const txResponse: ethers.TransactionResponse = await contract.transfer(activeNetwork.receiver, expectedAmountUnits);

      setTxHash(txResponse.hash);
      setMessage("Transaction submitted. Waiting for chain confirmation...");

      await txResponse.wait(1);
      await apiFetch<{ ok: boolean }>("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({ txHash: txResponse.hash, plan, networkId: activeNetwork.id }),
      });

      setMessage(`Payment confirmed and ${planMeta.label} tier activated.`);
      setTimeout(() => {
        window.location.href = "/terminal";
      }, 900);
    } catch (err) {
      setError(parseWalletPaymentError(err));
    } finally {
      setPaying(false);
    }
  }

  async function handlePayWithWallet() {
    if (!canUseWalletPay) {
      setError("Payment requirements are not satisfied.");
      return;
    }
    setConfirmChecked(false);
    setConfirmOpen(true);
  }

  return (
    <PageWrapper>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-24">
        <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f1218] p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">Checkout</p>
          <h1 className="mt-2 text-2xl font-bold text-white">{planMeta.label} Plan</h1>
          <p className="mt-2 text-sm text-zinc-400">
            One-time {stableSymbol || "USDC/USDT"} wallet payment extends your plan for 30 days.
          </p>

          {loading ? <p className="mt-4 text-sm text-zinc-400">Loading checkout...</p> : null}

          {!loading && !session?.authenticated ? (
            <div className="mt-5 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Wallet session not found. <Link href="/sign-in" className="underline">Sign in with wallet</Link> first.
            </div>
          ) : null}

          {!loading ? (
            <div className="mt-5 space-y-2 text-sm text-zinc-300">
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    walletConnected
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
                  }`}
                >
                  {walletConnected ? "Wallet Connected" : "Wallet Not Connected"}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    canUseWalletPay
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-400/30 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  {canUseWalletPay ? "Payment Eligible" : "Payment Not Eligible"}
                </span>
              </div>
              <p>
                Price: <span className="font-semibold text-white">${priceUsd}</span>
              </p>
              <p>
                Pay amount: <span className="font-semibold text-white">{displayAmount} {stableSymbol || "USDC/USDT"}</span>
              </p>
              <p>
                Network: <span className="text-zinc-200">{activeNetwork?.label || "Not configured"}</span>
              </p>
              <p>
                Receiver: <span className="font-mono text-xs text-zinc-200">{activeNetwork?.receiver || "Not configured"}</span>
              </p>
              <p>
                Chain: <span className="text-zinc-200">{activeNetwork?.chainId || "Not configured"}</span>
              </p>
              <p>
                Token contract: <span className="font-mono text-xs text-zinc-200">{activeNetwork?.tokenAddress || "Not configured"}</span>
              </p>
              {session?.walletAddress ? (
                <p>
                  Signed wallet: <span className="font-mono text-xs text-zinc-200">{session.walletAddress}</span>
                </p>
              ) : null}
              {walletChainId ? (
                <p>
                  Wallet chain: <span className="text-zinc-200">{walletChainId}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {!loading && !paymentReady ? (
            <div className="mt-5 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Payment is temporarily unavailable. Admin must configure receiver, chain ID, token contract, and token symbol (USDC/USDT).
            </div>
          ) : null}
          {!loading && walletConnected && walletChainId && !walletChainSupported ? (
            <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Your current wallet network (chain {walletChainId}) is not in the supported payment network list.
            </div>
          ) : null}
          {!loading && walletConnected && walletChainMismatch ? (
            <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Selected payment network is chain {activeNetwork?.chainId}. Your wallet is currently on chain {walletChainId}. A switch request will appear before transfer.
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {selectableNetworks.length > 0 ? (
              <div className="rounded-lg border border-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-zinc-500">Select network and token</p>
                <div className="mt-2">
                  <select
                    value={activeNetwork.id}
                    onChange={(event) => setSelectedNetworkId(event.target.value)}
                    className="w-full rounded-md border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60"
                  >
                    {selectableNetworks.map((network) => {
                      const chainLabel = network.label || `Chain ${network.chainId || "?"}`;
                      const symbol = String(network.tokenSymbol || "").toUpperCase() || "USDC/USDT";
                      const hasSymbolInLabel = /\bUSDC\b|\bUSDT\b/i.test(chainLabel);
                      return (
                        <option key={network.id} value={network.id}>
                          {hasSymbolInLabel ? chainLabel : `${chainLabel} - ${symbol}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="mt-3 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300">
                  <p>Chain ID: {activeNetwork?.chainId || "?"}</p>
                  <p className="mt-1">Token: {String(activeNetwork?.tokenSymbol || "").toUpperCase() || "USDC/USDT"}</p>
                  <p className="mt-1 font-mono break-all">{activeNetwork?.tokenAddress || "Token not configured"}</p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={!canUseWalletPay || paying}
              onClick={handlePayWithWallet}
              className="w-full rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paying ? "Processing payment..." : `Pay with wallet (${stableSymbol || "USDC/USDT"})`}
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

          {activeNetwork?.txExplorerBaseUrl && txHash ? (
            <a
              href={`${activeNetwork.txExplorerBaseUrl.replace(/\/+$/, "")}/${txHash}`}
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
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#121722] p-5">
            <h2 className="text-lg font-semibold text-white">Confirm payment details</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Review receiver, chain, and token contract before approving transfer in your wallet.
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-200">
              <p>Plan: <span className="font-semibold text-white">{planMeta.label}</span></p>
              <p>Amount: <span className="font-semibold text-white">{displayAmount} {stableSymbol || "USDC/USDT"}</span></p>
              <p>Chain ID: <span className="font-semibold text-white">{activeNetwork?.chainId || "N/A"}</span></p>
              <p>Receiver: <span className="font-mono text-xs text-white">{activeNetwork?.receiver || "N/A"}</span></p>
              <p>Token: <span className="font-mono text-xs text-white">{activeNetwork?.tokenAddress || "N/A"}</span></p>
              <p className="text-amber-300">
                If your wallet is on a different chain, it will ask for an explicit chain switch confirmation.
              </p>
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(event) => setConfirmChecked(event.target.checked)}
                className="mt-0.5"
              />
              <span>I verified all payment details above.</span>
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-md border border-white/20 px-3 py-2 text-sm text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmChecked || paying}
                onClick={async () => {
                  setConfirmOpen(false);
                  await executeWalletPayment();
                }}
                className="flex-1 rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paying ? "Processing..." : "Confirm and Pay"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageWrapper>
  );
}
