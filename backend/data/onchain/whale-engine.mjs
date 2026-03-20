import crypto from "node:crypto";
import { canonicalSymbol } from "../core/symbol-map.mjs";
import { buildWhaleConfig, getWhaleThreshold } from "./whale-config.mjs";
import { createWalletLabeler } from "./wallet-labels.mjs";

function toIso(value) {
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function detectChainGroup(chainName) {
  const lower = String(chainName || "").toLowerCase();
  if (lower.includes("solana")) return "solana";
  return "evm";
}

function inferEventType({ token, fromLabelType, toLabelType, rawText, whaleConfig }) {
  const text = String(rawText || "").toLowerCase();
  const isStable = whaleConfig.stablecoins.has(token);
  if (isStable && /\bmint/.test(text)) return "stablecoin_mint";
  if (isStable && /\bburn/.test(text)) return "stablecoin_burn";
  if (toLabelType === "exchange") return "exchange_inflow";
  if (fromLabelType === "exchange") return "exchange_outflow";
  if (fromLabelType === "treasury" || toLabelType === "treasury") return "treasury_movement";
  if (fromLabelType === "smart_money" || toLabelType === "smart_money") return "smart_money_watch";
  return "large_transfer";
}

function normalizeEventType(input) {
  const value = String(input || "").toLowerCase().trim();
  if (!value) return null;
  const allowed = new Set([
    "large_transfer",
    "exchange_inflow",
    "exchange_outflow",
    "stablecoin_mint",
    "stablecoin_burn",
    "treasury_movement",
    "smart_money_watch",
  ]);
  return allowed.has(value) ? value : null;
}

function clip(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreSignificance({ usdValue, eventType, token, relatedAssets, fromLabelType, toLabelType, watchlistSet, whaleConfig }) {
  const sizeScore = clip(Math.log10(Math.max(usdValue, 1)) * 9.5, 0, 50);
  const exchangeBoost = fromLabelType === "exchange" || toLabelType === "exchange" ? 16 : 0;
  const stablecoinBoost = whaleConfig.stablecoins.has(token) ? 12 : 0;
  const watchlistBoost = relatedAssets.some((asset) => watchlistSet.has(asset)) ? 12 : 0;
  const entityBoost = ["treasury", "smart_money"].includes(fromLabelType) || ["treasury", "smart_money"].includes(toLabelType) ? 10 : 0;
  const eventBoost =
    eventType === "stablecoin_mint" || eventType === "stablecoin_burn"
      ? 8
      : eventType === "exchange_inflow" || eventType === "exchange_outflow"
        ? 6
        : 0;
  return clip(sizeScore + exchangeBoost + stablecoinBoost + watchlistBoost + entityBoost + eventBoost, 1, 99);
}

function computeConfidence({ txHash, usdValue, fromLabelType, toLabelType }) {
  let score = 0.45;
  if (txHash) score += 0.2;
  if (usdValue > 0) score += 0.15;
  if (fromLabelType !== "unknown") score += 0.1;
  if (toLabelType !== "unknown") score += 0.1;
  return clip(Number(score.toFixed(2)), 0.2, 0.98);
}

function hashId(seed) {
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 24);
}

function normalizeAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function deriveRelatedAssets(token, rawRelatedAssets = []) {
  const related = new Set();
  if (token) related.add(token);
  (Array.isArray(rawRelatedAssets) ? rawRelatedAssets : []).forEach((item) => {
    const normalized = canonicalSymbol(item);
    if (normalized) related.add(normalized);
  });
  return Array.from(related).slice(0, 6);
}

export function createWhaleEventEngine({ watchlistTickers = [], extraWalletLabels = [], env = process.env } = {}) {
  const whaleConfig = buildWhaleConfig(env);
  const labeler = createWalletLabeler(extraWalletLabels);
  const watchlistSet = new Set((Array.isArray(watchlistTickers) ? watchlistTickers : []).map((item) => canonicalSymbol(item)).filter(Boolean));

  function normalize(rawEvent) {
    const chainGroup = detectChainGroup(rawEvent.chain || rawEvent.blockchain);
    const chain = String(rawEvent.chain || rawEvent.blockchain || "unknown").toLowerCase();
    const token = canonicalSymbol(rawEvent.token || rawEvent.symbol || rawEvent.asset || "BTC") || "BTC";
    const amount = normalizeAmount(rawEvent.amount);
    const usdValue = normalizeAmount(rawEvent.usdValue ?? rawEvent.amountUsd ?? rawEvent.amount_usd);
    const txHash = rawEvent.txHash || rawEvent.hash || null;

    const fromInfo = labeler.resolve({
      chain: chainGroup,
      rawLabel: rawEvent.fromLabel || rawEvent.from?.label || rawEvent.from?.owner_type || rawEvent.from,
      ownerType: rawEvent.fromOwnerType || rawEvent.from?.owner_type,
      address: rawEvent.fromAddress || rawEvent.from?.address,
    });
    const toInfo = labeler.resolve({
      chain: chainGroup,
      rawLabel: rawEvent.toLabel || rawEvent.to?.label || rawEvent.to?.owner_type || rawEvent.to,
      ownerType: rawEvent.toOwnerType || rawEvent.to?.owner_type,
      address: rawEvent.toAddress || rawEvent.to?.address,
    });

    const eventType =
      normalizeEventType(rawEvent.eventType) ||
      inferEventType({
        token,
        fromLabelType: fromInfo.labelType,
        toLabelType: toInfo.labelType,
        rawText: rawEvent.rawText || "",
        whaleConfig,
      });
    const relatedAssets = deriveRelatedAssets(token, rawEvent.relatedAssets);
    const significance = scoreSignificance({
      usdValue,
      eventType,
      token,
      relatedAssets,
      fromLabelType: fromInfo.labelType,
      toLabelType: toInfo.labelType,
      watchlistSet,
      whaleConfig,
    });
    const confidence = computeConfidence({
      txHash,
      usdValue,
      fromLabelType: fromInfo.labelType,
      toLabelType: toInfo.labelType,
    });

    const threshold = getWhaleThreshold(whaleConfig, { chainGroup, token, eventType });
    if (usdValue < threshold) return null;

    return {
      id: String(rawEvent.id || hashId(`${chain}|${token}|${txHash || ""}|${usdValue}|${rawEvent.timestamp || ""}`)),
      chain,
      txHash: txHash ? String(txHash) : null,
      token,
      amount,
      usdValue,
      fromLabel: fromInfo.label,
      toLabel: toInfo.label,
      eventType,
      timestamp: toIso(rawEvent.timestamp),
      confidence,
      significance,
      relatedAssets,
      labels: {
        from: fromInfo.labelType,
        to: toInfo.labelType,
      },
      provider: rawEvent.provider || "unknown",
      rawText: String(rawEvent.rawText || ""),
    };
  }

  function normalizeBatch(rawEvents) {
    return (Array.isArray(rawEvents) ? rawEvents : [])
      .map((row) => normalize(row))
      .filter(Boolean)
      .sort((a, b) => b.significance - a.significance || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  return {
    normalize,
    normalizeBatch,
  };
}
