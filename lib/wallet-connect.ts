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
