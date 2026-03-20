"use client";

export type WalletProviderKind = "evm" | "solana";
export type SupportedWalletLabel =
  | "MetaMask"
  | "Rabby"
  | "Coinbase Wallet"
  | "Phantom"
  | "Solflare"
  | "WalletConnect";

export interface EthereumProvider {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: EthereumProvider[];
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  disconnect?: () => Promise<void> | void;
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
}

export interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  request?: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  connect: () => Promise<{ publicKey?: { toString: () => string } }>;
  disconnect?: () => Promise<void> | void;
}

export type ConnectedWalletSession = {
  walletLabel: SupportedWalletLabel;
  kind: WalletProviderKind;
  address: string;
  provider: EthereumProvider | SolanaProvider;
  disconnectTargets: Array<EthereumProvider | SolanaProvider>;
};

export type WalletSessionListenerCleanup = () => void;

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    rabby?: EthereumProvider;
    coinbaseWalletExtension?: EthereumProvider;
    phantom?: {
      solana?: SolanaProvider;
    };
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
  }
}

function getInjectedEthereumProvider(wallet: SupportedWalletLabel) {
  const root = window.ethereum;
  const providers = root?.providers?.length ? root.providers : root ? [root] : [];
  const uniqueProviders = [
    ...new Set<EthereumProvider>(
      [...providers, window.rabby, window.coinbaseWalletExtension].filter(Boolean) as EthereumProvider[]
    ),
  ];

  switch (wallet) {
    case "MetaMask":
      return (
        uniqueProviders.find(
          (provider) => provider.isMetaMask && !provider.isRabby && !provider.isCoinbaseWallet
        ) ?? null
      );
    case "Rabby":
      return window.rabby ?? uniqueProviders.find((provider) => provider.isRabby) ?? null;
    case "Coinbase Wallet":
      return (
        window.coinbaseWalletExtension ??
        uniqueProviders.find((provider) => provider.isCoinbaseWallet) ??
        null
      );
    default:
      return null;
  }
}

async function connectEvmWallet(wallet: SupportedWalletLabel): Promise<ConnectedWalletSession> {
  const provider = getInjectedEthereumProvider(wallet);
  if (!provider) {
    throw new Error(`${wallet} is not available in this browser.`);
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts?.[0];

  if (!address) {
    throw new Error(`No wallet address returned from ${wallet}.`);
  }

  return {
    walletLabel: wallet,
    kind: "evm",
    address,
    provider,
    disconnectTargets: [provider],
  };
}

async function connectSolanaWallet(wallet: SupportedWalletLabel): Promise<ConnectedWalletSession> {
  const candidates =
    wallet === "Phantom"
      ? [
          window.phantom?.solana,
          window.solana?.isPhantom ? window.solana : undefined,
          window.solflare?.isPhantom ? window.solflare : undefined,
        ]
      : wallet === "Solflare"
        ? [
            window.solflare,
            window.solana?.isSolflare ? window.solana : undefined,
            window.phantom?.solana?.isSolflare ? window.phantom.solana : undefined,
          ]
        : [];

  const disconnectTargets = [...new Set<SolanaProvider>(candidates.filter(Boolean) as SolanaProvider[])];
  const provider = disconnectTargets[0] ?? null;

  if (!provider) {
    throw new Error(`${wallet} is not available in this browser.`);
  }

  const response = await provider.connect();
  const address = response.publicKey?.toString();

  if (!address) {
    throw new Error(`No wallet address returned from ${wallet}.`);
  }

  return {
    walletLabel: wallet,
    kind: "solana",
    address,
    provider,
    disconnectTargets,
  };
}

export async function connectWalletByLabel(wallet: SupportedWalletLabel): Promise<ConnectedWalletSession> {
  if (wallet === "MetaMask" || wallet === "Rabby" || wallet === "Coinbase Wallet") {
    return connectEvmWallet(wallet);
  }

  if (wallet === "Phantom" || wallet === "Solflare") {
    return connectSolanaWallet(wallet);
  }

  throw new Error(`${wallet} integration is not available yet.`);
}

export function isWalletInstalled(wallet: SupportedWalletLabel) {
  if (typeof window === "undefined") return false;
  if (wallet === "MetaMask" || wallet === "Rabby" || wallet === "Coinbase Wallet") {
    return Boolean(getInjectedEthereumProvider(wallet));
  }
  if (wallet === "Phantom") {
    return Boolean(window.phantom?.solana || window.solana?.isPhantom || window.solflare?.isPhantom);
  }
  if (wallet === "Solflare") {
    return Boolean(window.solflare || window.solana?.isSolflare || window.phantom?.solana?.isSolflare);
  }
  return false;
}

export function walletInstallUrl(wallet: SupportedWalletLabel) {
  switch (wallet) {
    case "MetaMask":
      return "https://metamask.io/download/";
    case "Rabby":
      return "https://rabby.io/";
    case "Coinbase Wallet":
      return "https://www.coinbase.com/wallet/downloads";
    case "Phantom":
      return "https://phantom.app/download";
    case "Solflare":
      return "https://solflare.com/download";
    default:
      return "";
  }
}

export function subscribeWalletSession(
  session: ConnectedWalletSession,
  handlers: {
    onDisconnect: () => void;
    onAddressChange?: (nextAddress: string) => void;
  },
): WalletSessionListenerCleanup {
  const cleanup: Array<() => void> = [];

  for (const target of session.disconnectTargets) {
    if (!target.on) continue;

    if (session.kind === "evm") {
      const provider = target as EthereumProvider;
      const accountHandler = (accounts: unknown) => {
        const nextAddress = Array.isArray(accounts) ? String(accounts[0] || "") : "";
        if (!nextAddress) {
          handlers.onDisconnect();
          return;
        }
        handlers.onAddressChange?.(nextAddress);
      };
      const disconnectHandler = () => handlers.onDisconnect();

      provider.on?.("accountsChanged", accountHandler);
      provider.on?.("disconnect", disconnectHandler);
      cleanup.push(() => {
        provider.removeListener?.("accountsChanged", accountHandler);
        provider.off?.("accountsChanged", accountHandler);
        provider.removeListener?.("disconnect", disconnectHandler);
        provider.off?.("disconnect", disconnectHandler);
      });
      continue;
    }

    const provider = target as SolanaProvider;
    const accountHandler = (publicKey: unknown) => {
      const nextAddress =
        publicKey && typeof publicKey === "object" && "toString" in publicKey
          ? (publicKey as { toString: () => string }).toString()
          : "";
      if (!nextAddress) {
        handlers.onDisconnect();
        return;
      }
      handlers.onAddressChange?.(nextAddress);
    };
    const disconnectHandler = () => handlers.onDisconnect();

    provider.on?.("accountChanged", accountHandler);
    provider.on?.("disconnect", disconnectHandler);
    cleanup.push(() => {
      provider.removeListener?.("accountChanged", accountHandler);
      provider.off?.("accountChanged", accountHandler);
      provider.removeListener?.("disconnect", disconnectHandler);
      provider.off?.("disconnect", disconnectHandler);
    });
  }

  return () => {
    cleanup.forEach((item) => item());
  };
}

export async function disconnectWalletSession(session: ConnectedWalletSession) {
  for (const target of session.disconnectTargets) {
    if (typeof target.disconnect === "function") {
      await target.disconnect();
    }

    if (session.kind === "evm" && "request" in target && typeof target.request === "function") {
      try {
        await target.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // provider may not support explicit revoke
      }
    }

    if (session.kind === "solana" && "request" in target && typeof target.request === "function") {
      try {
        await target.request({ method: "disconnect" });
      } catch {
        // provider may not support request-style disconnect
      }
    }
  }
}

export function formatWalletAddress(address: string) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
