import { TtlCache } from "./core/ttl-cache.mjs";
import { SlidingWindowRateLimiter, runRateLimited } from "./core/rate-limit.mjs";
import { createEventBus } from "./core/event-bus.mjs";
import { CORE_SYMBOLS, canonicalSymbol } from "./core/symbol-map.mjs";
import {
  toFrontendLiquidation,
  toFrontendNewsItem,
  toFrontendQuote,
  toFrontendWhaleItem,
} from "./core/normalize.mjs";
import { fetchCoingeckoMarketData } from "./adapters/coingecko-market.adapter.mjs";
import { fetchCoincapMarketData } from "./adapters/coincap-market.adapter.mjs";
import { fetchCoinpaprikaMarketData } from "./adapters/coinpaprika-market.adapter.mjs";
import { fetchCoinloreMarketData } from "./adapters/coinlore-market.adapter.mjs";
import { createHyperliquidMarketStream } from "./adapters/hyperliquid-ws-market.adapter.mjs";
import { fetchDexScreenerDiscovery } from "./adapters/dexscreener.adapter.mjs";
import { fetchRssNews } from "./adapters/news-rss.adapter.mjs";
import { getDefaultSocialRssFeeds } from "./adapters/news-rss.adapter.mjs";
import { getDefaultNitterSocialFeeds } from "./adapters/news-rss.adapter.mjs";
import { fetchJsonNews } from "./adapters/news-json.adapter.mjs";
import { fetchExchangeAnnouncements } from "./adapters/news-exchange-announcements.adapter.mjs";
import { fetchTreeOfAlphaNews } from "./adapters/news-treeofalpha.adapter.mjs";
import { createTreeOfAlphaNewsStream } from "./adapters/news-treeofalpha.adapter.mjs";
import { fetchNinjaNewsBundle } from "./adapters/news-ninjanews.adapter.mjs";
import {
  createBinanceLargeTradeStream,
  createBybitLargeTradeStream,
  createBybitLiquidationEventStream,
  createLiquidationEventStream,
  createOkxLargeTradeStream,
  createOkxLiquidationEventStream,
  fetchOnchainWhaleEvents,
} from "./adapters/onchain-whale-events.adapter.mjs";
import { fetchCoingeckoCoinMetadata } from "./adapters/coingecko-metadata.adapter.mjs";
import { fetchCoinpaprikaCoinMetadata } from "./adapters/coinpaprika-metadata.adapter.mjs";
import { fetchBinanceLargeTradeEvents } from "./adapters/whale-binance-trades.adapter.mjs";
import { createNewsIngestionEngine } from "./news/news-engine.mjs";
import { createWhaleEventEngine } from "./onchain/whale-engine.mjs";
import { createWatchlistRelevance } from "./core/watchlist-relevance.mjs";
import { createRuleAnalysisEngine } from "./analysis/rule-analysis.mjs";
import { getVenueQuotes } from "../services/venue-service.mjs";
import {
  createBinanceQuoteStream,
  createBybitQuoteStream,
  createOkxQuoteStream,
} from "../services/market-service.mjs";
import { getDefiLlamaTvl, getEthGas, getFearGreed, getForexRates, getMempoolStats } from "../services/stats-service.mjs";

function dedupeBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toMs(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function maxTimestamp(values = []) {
  return values.reduce((max, value) => {
    const ts = toMs(value);
    return ts > max ? ts : max;
  }, 0);
}

export function createTerminalDataService({ config, logger }) {
  const cache = new TtlCache();
  const limiter = new SlidingWindowRateLimiter({ limit: 120, windowMs: 60_000 });
  const events = createEventBus();
  const featureFlags = config.featureFlags || {};
  const ttl = config.dataTtl || {};
  // Keep CoinGecko payload lean to reduce free-tier 429 pressure.
  const coreSymbols = CORE_SYMBOLS.slice(0, 12);
  const newsEngine = createNewsIngestionEngine({
    watchlistTickers: config.watchlistTickers,
    logger,
  });
  const whaleEngine = createWhaleEventEngine({
    watchlistTickers: config.watchlistTickers,
  });
  const relevanceEngine = createWatchlistRelevance({
    watchlistTickers: config.watchlistTickers,
  });
  const analysisEngine = createRuleAnalysisEngine();

  const state = {
    quotes: [],
    venueQuotes: { Binance: [], OKX: [], Bybit: [] },
    marketStats: null,
    mempoolStats: null,
    fearGreed: null,
    ethGas: null,
    defiTvl: null,
    forex: null,
    liquidations: [],
    news: [],
    whales: [],
    social: [],
    whaleEvents: [],
    selectedEventAnalysis: null,
    newsSnapshot: {
      generatedAt: new Date().toISOString(),
      count: 0,
      items: [],
      clusters: [],
      status: "empty",
      errors: [],
    },
    discovery: [],
    coinMetadata: {},
    connectionState: "connecting",
  };

  const providerState = {
    coingecko_market: "idle",
    coingecko_metadata: "idle",
    hyperliquid_ws: "idle",
    dexscreener: "idle",
    news: "idle",
    whales: "idle",
  };

  const providerHealth = {
    coingecko_market: { status: "idle", providerCalls: 0, cacheHits: 0, staleServed: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null },
    coingecko_metadata: { status: "idle", providerCalls: 0, cacheHits: 0, staleServed: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null },
    hyperliquid_ws: { status: "idle", providerCalls: 0, cacheHits: 0, staleServed: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null },
    dexscreener: { status: "idle", providerCalls: 0, cacheHits: 0, staleServed: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null },
    news: { status: "idle", providerCalls: 0, cacheHits: 0, staleServed: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null },
    whales: { status: "idle", providerCalls: 0, cacheHits: 0, staleServed: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null },
  };
  const providerCooldownUntil = new Map();
  const providerRateLimitState = new Map();

  function isRateLimitedError(error) {
    const message = String(error || "").toLowerCase();
    return message.includes("http 429") || message.includes("rate_limit_exceeded");
  }

  const NEWS_SOURCES = ["rss", "json", "exchange_announcements", "tree", "ninja", "social_rss"];
  const newsSourceHealth = NEWS_SOURCES.reduce((acc, source) => {
    acc[source] = {
      status: "idle",
      enabled: true,
      lastFetchedAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      lastCount: 0,
      errorStreak: 0,
      nextRetryAt: null,
    };
    return acc;
  }, {});

  let started = false;
  let stopHyperliquid = null;
  let stopBinanceQuotes = null;
  let stopOkxQuotes = null;
  let stopBybitQuotes = null;
  let stopLiquidations = null;
  let stopBybitLiquidations = null;
  let stopOkxLiquidations = null;
  let stopWhaleTape = null;
  let stopBybitWhaleTape = null;
  let stopOkxWhaleTape = null;
  let stopTreeNews = null;
  let intervals = [];
  const whaleEventThrottle = new Map();
  const whaleMinIntervalMs = Math.max(500, Number(config.whaleFallback?.minIntervalMs || 8000));
  const whaleMinUsd = Math.max(10_000_000, Number(config.whaleFallback?.minUsd || 10_000_000));

  function publish(type, payload) {
    events.publish("stream", {
      type,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  function mergeQuotePatch(ticks) {
    const bySymbol = new Map(state.quotes.map((item) => [item.symbol, item]));
    ticks.forEach((tick) => {
      bySymbol.set(tick.symbol, toFrontendQuote(tick));
    });
    state.quotes = Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  function canPublishWhaleEvent(event) {
    const key = `${String(event?.provider || "unknown")}::${String(event?.token || "UNK")}::${String(event?.eventType || "event")}`;
    const now = Date.now();
    const last = whaleEventThrottle.get(key) || 0;
    if (now - last < whaleMinIntervalMs) return false;
    whaleEventThrottle.set(key, now);
    return true;
  }

  function mergeVenueQuotePatch(venue, quotes) {
    const venueKey = venue === "OKX" ? "OKX" : venue === "Bybit" ? "Bybit" : "Binance";
    const current = Array.isArray(state.venueQuotes?.[venueKey]) ? state.venueQuotes[venueKey] : [];
    const bySymbol = new Map(current.map((item) => [item.symbol, item]));
    (Array.isArray(quotes) ? quotes : []).forEach((quote) => {
      if (!quote?.symbol) return;
      bySymbol.set(quote.symbol, quote);
    });
    state.venueQuotes = {
      ...state.venueQuotes,
      [venueKey]: Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    };
  }

  function markProvider(provider, status, error = null) {
    const previous = providerState[provider];
    providerState[provider] = status;
    if (!providerHealth[provider]) return;
    providerHealth[provider].status = status;
    if (status === "ok" || status === "fallback") {
      providerHealth[provider].lastSuccessAt = new Date().toISOString();
      providerHealth[provider].lastError = null;
    }
    if (error) {
      providerHealth[provider].lastError = String(error);
      providerHealth[provider].lastErrorAt = new Date().toISOString();
    }
    if (config.logLevel === "debug" && previous !== status) {
      logger?.info?.("data.provider.status", { provider, from: previous, to: status });
    }
    updateConnectionState();
  }

  function updateConnectionState() {
    const statuses = Object.values(providerState);
    const hasActive = statuses.some((status) => ["ok", "cache", "stale", "fallback"].includes(status));
    const hasDegraded = statuses.some((status) => status === "degraded");
    if (hasActive && !hasDegraded) {
      state.connectionState = "connected";
      return;
    }
    if (hasActive && hasDegraded) {
      state.connectionState = "degraded";
      return;
    }
    state.connectionState = "connecting";
  }

  function markNewsSource(source, patch = {}) {
    if (!newsSourceHealth[source]) return;
    newsSourceHealth[source] = {
      ...newsSourceHealth[source],
      ...patch,
    };
  }

  function sourceBackoffMs(errorStreak = 0) {
    const streak = Math.max(0, Number(errorStreak) || 0);
    if (streak === 0) return 0;
    return Math.min(60_000, 2_000 * (2 ** (streak - 1)));
  }

  async function fetchNewsSource(source, enabled, fetcher) {
    const now = Date.now();
    if (!enabled) {
      markNewsSource(source, {
        status: "disabled",
        enabled: false,
        lastCount: 0,
      });
      return [];
    }

    const health = newsSourceHealth[source];
    const nextRetryMs = health?.nextRetryAt ? toMs(health.nextRetryAt) : 0;
    if (nextRetryMs > now) {
      markNewsSource(source, {
        status: "backoff",
        enabled: true,
      });
      return [];
    }

    try {
      const rows = await fetcher();
      const count = Array.isArray(rows) ? rows.length : 0;
      const fetchedAt = new Date().toISOString();
      markNewsSource(source, {
        status: count > 0 ? "ok" : "empty",
        enabled: true,
        lastFetchedAt: fetchedAt,
        lastSuccessAt: fetchedAt,
        lastCount: count,
        errorStreak: 0,
        nextRetryAt: null,
        lastError: null,
      });
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      const streak = (newsSourceHealth[source]?.errorStreak || 0) + 1;
      const retryAt = new Date(now + sourceBackoffMs(streak)).toISOString();
      markNewsSource(source, {
        status: "error",
        enabled: true,
        lastFetchedAt: new Date().toISOString(),
        lastErrorAt: new Date().toISOString(),
        lastError: String(error),
        errorStreak: streak,
        nextRetryAt: retryAt,
        lastCount: 0,
      });
      logger?.warn?.("data.news.source_failed", { source, error: String(error), streak });
      return [];
    }
  }

  async function callWithFallback({ cacheKey, ttlMs, staleMs, limiterKey, primary, fallback, providerName }) {
    const cacheResult = await cache.remember(cacheKey, { ttlMs, staleMs }, async () => {
      const now = Date.now();
      const cooldownUntil = providerCooldownUntil.get(providerName) || 0;
      if (fallback && cooldownUntil > now) {
        providerHealth[providerName].staleServed += 1;
        markProvider(providerName, "fallback");
        return fallback();
      }
      try {
        markProvider(providerName, "fetching");
        providerHealth[providerName].providerCalls += 1;
        const value = await runRateLimited(limiter, limiterKey, primary);
        providerCooldownUntil.set(providerName, 0);
        providerRateLimitState.set(providerName, { streak: 0, lastCooldownMs: 0 });
        markProvider(providerName, "ok");
        return value;
      } catch (primaryError) {
        if (isRateLimitedError(primaryError)) {
          const previous = providerRateLimitState.get(providerName) || { streak: 0, lastCooldownMs: 0 };
          const nextStreak = Math.max(1, Number(previous.streak) + 1);
          // Keep cooldown bounded for free-tier resilience:
          // starts around 60s and grows exponentially up to 15 minutes.
          const baseCooldownMs = Math.min(5 * 60_000, Math.max(60_000, Number(ttlMs) || 20_000));
          const exponentialCooldown = Math.min(15 * 60_000, baseCooldownMs * (2 ** (nextStreak - 1)));
          const jitter = Math.floor(Math.random() * Math.max(1000, exponentialCooldown * 0.15));
          const cooldownMs = Math.min(15 * 60_000, exponentialCooldown + jitter);
          providerRateLimitState.set(providerName, { streak: nextStreak, lastCooldownMs: cooldownMs });
          providerCooldownUntil.set(providerName, Date.now() + cooldownMs);
          logger?.warn?.("data.provider.rate_limited_backoff", {
            provider: providerName,
            streak: nextStreak,
            cooldownMs,
          });
        }
        if (!fallback) {
          markProvider(providerName, "degraded", primaryError);
          throw primaryError;
        }
        logger?.warn?.("data.provider.primary_failed", {
          provider: providerName,
          error: String(primaryError),
        });
        try {
          const value = await fallback();
          markProvider(providerName, "fallback");
          return value;
        } catch (fallbackError) {
          markProvider(providerName, "degraded", fallbackError);
          throw fallbackError;
        }
      }
    });
    if (cacheResult.source === "cache:fresh") {
      providerHealth[providerName].cacheHits += 1;
      markProvider(providerName, "cache");
    } else if (cacheResult.source === "cache:stale") {
      providerHealth[providerName].staleServed += 1;
      markProvider(providerName, "stale");
    }
    return cacheResult;
  }

  async function refreshMarketLayer() {
    if (!featureFlags.enableCoinGeckoMarket) {
      markProvider("coingecko_market", "disabled");
      return;
    }
    const result = await callWithFallback({
      cacheKey: "core:coingecko",
      ttlMs: ttl.marketSnapshotMs || 20_000,
      staleMs: 120_000,
      limiterKey: "coingecko_market",
      providerName: "coingecko_market",
      primary: () => fetchCoingeckoMarketData({ symbols: coreSymbols }),
      fallback: async () => {
        if (featureFlags.enableCoincap !== false) {
          try {
            return await fetchCoincapMarketData({ symbols: coreSymbols });
          } catch {
            // continue to coinpaprika
          }
        }
        if (featureFlags.enableCoinpaprika !== false) {
          try {
            return await fetchCoinpaprikaMarketData({ symbols: coreSymbols });
          } catch {
            // continue
          }
        }
        if (featureFlags.enableCoinlore !== false) {
          try {
            return await fetchCoinloreMarketData({ symbols: coreSymbols });
          } catch {
            // continue to state fallback
          }
        }
        return { ticks: [], marketStats: state.marketStats };
      },
    });

    if (Array.isArray(result.value.ticks) && result.value.ticks.length > 0) {
      mergeQuotePatch(result.value.ticks);
      publish("quotes", state.quotes);
    }

    if (result.value.marketStats) {
      state.marketStats = {
        ...result.value.marketStats,
        btcDominance:
          result.value.marketStats.btcDominance != null
            ? Math.round(Number(result.value.marketStats.btcDominance) * 10) / 10
            : null,
        ethDominance:
          result.value.marketStats.ethDominance != null
            ? Math.round(Number(result.value.marketStats.ethDominance) * 10) / 10
            : null,
      };
      publish("marketStats", state.marketStats);
    }
  }

  async function refreshCoinMetadataLayer() {
    if (!featureFlags.enableCoinGeckoMetadata) {
      markProvider("coingecko_metadata", "disabled");
      return;
    }
    const result = await callWithFallback({
      cacheKey: "core:coin-metadata",
      ttlMs: ttl.coinMetadataMs || 6 * 60 * 60 * 1000,
      staleMs: Math.max(ttl.coinMetadataMs || 6 * 60 * 60 * 1000, 12 * 60 * 60 * 1000),
      limiterKey: "coingecko_metadata",
      providerName: "coingecko_metadata",
      primary: () => fetchCoingeckoCoinMetadata({ symbols: coreSymbols }),
      fallback: async () => {
        if (featureFlags.enableCoinpaprika !== false) {
          try {
            return await fetchCoinpaprikaCoinMetadata({ symbols: coreSymbols });
          } catch {
            return state.coinMetadata;
          }
        }
        return state.coinMetadata;
      },
    });
    state.coinMetadata = result.value || {};
  }

  async function refreshDiscoveryLayer() {
    if (!featureFlags.enableDexScreener) {
      markProvider("dexscreener", "disabled");
      return;
    }
    const result = await callWithFallback({
      cacheKey: "core:dexscreener",
      ttlMs: ttl.discoveryMs || 45_000,
      staleMs: 180_000,
      limiterKey: "dexscreener_discovery",
      providerName: "dexscreener",
      primary: () => fetchDexScreenerDiscovery({ symbols: coreSymbols }),
      fallback: async () => state.discovery,
    });
    state.discovery = result.value;
  }

  async function refreshNewsLayer() {
    const rssEnabled = featureFlags.enableNewsRss !== false;
    const jsonEnabled = featureFlags.enableNewsJson !== false;
    const exchangeAnnouncementsEnabled = featureFlags.enableNewsExchangeAnnouncements !== false;
    const treeEnabled = featureFlags.enableNewsTree !== false;
    const ninjaEnabled = featureFlags.enableNewsNinja !== false;
    if (!rssEnabled && !jsonEnabled && !exchangeAnnouncementsEnabled && !treeEnabled && !ninjaEnabled) {
      markProvider("news", "disabled");
      return;
    }
    const result = await callWithFallback({
      cacheKey: "core:news",
      ttlMs: ttl.newsFeedMs || 60_000,
      staleMs: 180_000,
      limiterKey: "news_aggregate",
      providerName: "news",
      primary: async () => {
        const defaultSocialFeeds = config.enableDefaultSocialFeeds !== false
          ? getDefaultSocialRssFeeds(config.socialRedditSubreddits)
          : [];
        const nitterBases = Array.isArray(config.socialNitterInstances) && config.socialNitterInstances.length > 0
          ? config.socialNitterInstances
          : [config.nitterBaseUrl].filter(Boolean);
        const nitterFeeds = getDefaultNitterSocialFeeds(nitterBases, config.socialTwitterHandles);
        const socialFeeds = Array.isArray(config.socialRssUrls)
          ? config.socialRssUrls.map((url, index) => ({
              id: `social-${index}`,
              source: "Social RSS",
              url,
            }))
          : [];
        const dedupedFeedMap = new Map();
        [...defaultSocialFeeds, ...nitterFeeds, ...socialFeeds].forEach((feed) => {
          const key = String(feed.url || "").trim().toLowerCase();
          if (!key || dedupedFeedMap.has(key)) return;
          dedupedFeedMap.set(key, feed);
        });
        // Keep social fetch budget tight to avoid periodic latency spikes.
        const mergedSocialFeeds = Array.from(dedupedFeedMap.values()).slice(0, 12);
        const [rss, json, exchangeAnnouncements, tree, social, ninjaBundle] = await Promise.all([
          fetchNewsSource("rss", rssEnabled, () => fetchRssNews()),
          fetchNewsSource("json", jsonEnabled, () =>
            fetchJsonNews({
              cryptopanicKey: config.cryptopanicKey,
              cryptocompareApiKey: config.cryptocompareApiKey,
            }),
          ),
          fetchNewsSource("exchange_announcements", exchangeAnnouncementsEnabled, () =>
            fetchExchangeAnnouncements({ limit: ttl.exchangeAnnouncementsLimit || 30 }),
          ),
          fetchNewsSource("tree", treeEnabled, () => fetchTreeOfAlphaNews({ limit: ttl.treeNewsLimit || 300 })),
          fetchNewsSource("social_rss", mergedSocialFeeds.length > 0, () => fetchRssNews({ feeds: mergedSocialFeeds })),
          (async () => {
            const bundle = await fetchNewsSource("ninja", ninjaEnabled, () =>
              fetchNinjaNewsBundle({
                graphqlUrl: config.ninjaNewsGraphqlUrl,
                limit: ttl.ninjaNewsLimit || 30,
              }).then((data) => [data]),
            );
            return bundle[0] || { news: [], social: [] };
          })(),
        ]);
        const socialRows = social.map((item) => ({ ...item, sourceType: "social" }));
        const ninjaNewsRows = Array.isArray(ninjaBundle?.news) ? ninjaBundle.news : [];
        const ninjaSocialRows = Array.isArray(ninjaBundle?.social) ? ninjaBundle.social : [];
        const treeRows = (Array.isArray(tree) ? tree : []).map((item) => ({
          ...item,
          sourceType: item.sourceType || "news",
        }));
        const treeSocialRows = treeRows.filter((item) => item.sourceType === "social");
        const engineSnapshot = newsEngine.ingest([
          ...rss,
          ...json,
          ...exchangeAnnouncements,
          ...treeRows,
          ...ninjaNewsRows,
          ...socialRows,
          ...ninjaSocialRows,
        ]);
        const socialFeedRows = dedupeBy(
          [...treeSocialRows, ...ninjaSocialRows, ...socialRows]
            .sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp))
            .slice(0, 400),
          (item) => item.id,
        )
          .slice(0, 120)
          .map((item) =>
            toFrontendNewsItem({
              id: item.id,
              title: item.title,
              summary: item.summary,
              source: item.source,
              sourceType: "social",
              sentiment: item.sentiment || "neutral",
              importance: item.importance || "watch",
              tickers: item.tickers || [],
              relatedAssets: item.tickers || [],
              watchlistRelevance: 0,
              relevanceLabels: [],
              priorityLabel: "watchlist hit",
              timestamp: item.timestamp,
              url: item.url || "#",
            }),
          );
        if (engineSnapshot.count === 0) {
          const errors = [];
          if (rssEnabled && rss.length === 0) errors.push("rss_empty_or_unavailable");
          if (jsonEnabled && json.length === 0) errors.push("json_empty_or_unavailable");
          if (exchangeAnnouncementsEnabled && exchangeAnnouncements.length === 0) {
            errors.push("exchange_announcements_empty_or_unavailable");
          }
          if (treeEnabled && treeRows.length === 0) errors.push("tree_news_empty_or_unavailable");
          if (ninjaEnabled && ninjaNewsRows.length === 0 && ninjaSocialRows.length === 0) {
            errors.push("ninja_news_empty_or_unavailable");
          }
          if (mergedSocialFeeds.length > 0 && socialRows.length === 0) errors.push("social_rss_empty_or_unavailable");
          engineSnapshot.errors = errors;
        }
        return { engineSnapshot, socialFeedRows };
      },
      fallback: async () => state.newsSnapshot,
    });

    const snapshotEnvelope = result.value?.engineSnapshot ? result.value : { engineSnapshot: result.value, socialFeedRows: state.social };
    const snapshot = snapshotEnvelope.engineSnapshot || {
      generatedAt: new Date().toISOString(),
      count: 0,
      items: [],
      clusters: [],
      status: "empty",
      errors: [],
    };
    state.newsSnapshot = snapshot;
    const nextNews = (snapshot.items || []).map((item) =>
      toFrontendNewsItem({
        id: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        sourceType: item.sourceType || "news",
        sentiment: item.sentiment,
        importance:
          item.priority?.score >= 70
            ? "breaking"
            : item.priority?.score >= 45
              ? "market-moving"
              : "watch",
        tickers: item.tickers,
        relatedAssets: item.relatedAssets || item.tickers,
        watchlistRelevance: item.watchlistRelevance || 0,
        relevanceLabels: item.relevanceLabels || [],
        priorityLabel: item.priorityLabel || "low relevance",
        timestamp: item.publishedAt,
        url: item.url,
      }),
    );
    const nextPrimaryNews = nextNews
      .filter((item) => item.type !== "social")
      .sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp) || b.id.localeCompare(a.id));
    const nextSocial = Array.isArray(snapshotEnvelope.socialFeedRows)
      ? snapshotEnvelope.socialFeedRows
          .slice(0, 120)
          .sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp) || b.id.localeCompare(a.id))
      : nextNews
          .filter((item) => item.type === "social")
          .sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp) || b.id.localeCompare(a.id))
          .slice(0, 80);
    const prevIds = new Set(state.news.map((item) => item.id));
    // Preserve previously valid feeds if a refresh cycle returns empty due temporary provider outage.
    state.news = nextPrimaryNews.length > 0 ? nextPrimaryNews : state.news;
    state.social = nextSocial.length > 0 ? nextSocial : state.social;

    nextPrimaryNews.forEach((item) => {
      if (!prevIds.has(item.id) && item.type !== "social") {
        publish("news", item);
        const ranked = (snapshot.items || []).find((entry) => entry.id === item.id);
        if (ranked) {
          publish("newsRanked", ranked);
        }
      }
    });
    publish("social", state.social);
  }

  async function refreshWhaleLayer() {
    if (featureFlags.enableWhaleEngine === false) {
      markProvider("whales", "disabled");
      return;
    }
    const canUseWhaleAlert = featureFlags.enableWhaleApi !== false && Boolean(config.whaleAlertKey);
    const whalePrimary = canUseWhaleAlert
      ? () => fetchOnchainWhaleEvents({ whaleAlertKey: config.whaleAlertKey, minUsd: whaleMinUsd })
      : () =>
          fetchBinanceLargeTradeEvents({
            minUsd: whaleMinUsd,
            symbols: config.whaleFallback?.symbols,
          });
    const result = await callWithFallback({
      cacheKey: "core:whales",
      ttlMs: ttl.whaleScanMs || 75_000,
      staleMs: 240_000,
      limiterKey: "whale_alert",
      providerName: "whales",
      primary: whalePrimary,
      fallback: async () => [],
    });

    const normalizedEvents = whaleEngine.normalizeBatch(result.value || []).map((event) => {
      const relevance = relevanceEngine.score(event.relatedAssets, { priorityScore: event.significance });
      return {
        ...event,
        watchlistRelevance: relevance.score,
        relevanceLabels: relevance.labels,
        priorityLabel: relevance.priorityLabel,
      };
    });
    const whaleItems = normalizedEvents.map((event) => toFrontendWhaleItem(event));
    if (whaleItems.length > 0) {
      state.whaleEvents = dedupeBy([...normalizedEvents, ...state.whaleEvents], (item) => item.id).slice(0, 120);
      state.whales = dedupeBy([...whaleItems, ...state.whales], (item) => item.id).slice(0, 80);
      publish("whales", state.whales);
      publish("whaleEvents", state.whaleEvents);
    }
  }

  function startStreamingAdapters() {
    stopBinanceQuotes = createBinanceQuoteStream({
      logger,
      onQuotes(quotes) {
        mergeVenueQuotePatch("Binance", quotes);
        publish("venueQuotes", state.venueQuotes);
      },
    });

    stopOkxQuotes = createOkxQuoteStream({
      logger,
      onQuotes(quotes) {
        mergeVenueQuotePatch("OKX", quotes);
        publish("venueQuotes", state.venueQuotes);
      },
    });

    stopBybitQuotes = createBybitQuoteStream({
      logger,
      onQuotes(quotes) {
        mergeVenueQuotePatch("Bybit", quotes);
        publish("venueQuotes", state.venueQuotes);
      },
    });

    if (featureFlags.enableHyperliquidWs !== false) {
      stopHyperliquid = createHyperliquidMarketStream({
        logger,
        symbols: coreSymbols,
        onTicks(ticks) {
          mergeQuotePatch(ticks);
          state.connectionState = "connected";
          markProvider("hyperliquid_ws", "ok");
          providerHealth.hyperliquid_ws.lastSuccessAt = new Date().toISOString();
          publish("quotes", state.quotes);
        },
      });
    } else {
      markProvider("hyperliquid_ws", "disabled");
      stopHyperliquid = null;
    }

    stopLiquidations = createLiquidationEventStream({
      logger,
      onEvent(rawEvent) {
        const normalized = whaleEngine.normalize(rawEvent);
        if (!normalized) return;
        const relevance = relevanceEngine.score(normalized.relatedAssets, { priorityScore: normalized.significance });
        const enriched = {
          ...normalized,
          watchlistRelevance: relevance.score,
          relevanceLabels: relevance.labels,
          priorityLabel: relevance.priorityLabel,
        };
        const liquidation = toFrontendLiquidation(enriched);
        state.liquidations = [liquidation, ...state.liquidations.filter((item) => item.id !== liquidation.id)].slice(0, 120);
        publish("liquidation", liquidation);
      },
    });
    stopBybitLiquidations = createBybitLiquidationEventStream({
      logger,
      symbols: (config.whaleFallback?.symbols || ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"])
        .map((s) => String(s || "").toUpperCase()),
      minUsd: 5_000,
      onEvent(rawEvent) {
        const normalized = whaleEngine.normalize(rawEvent);
        if (!normalized) return;
        const relevance = relevanceEngine.score(normalized.relatedAssets, { priorityScore: normalized.significance });
        const enriched = {
          ...normalized,
          watchlistRelevance: relevance.score,
          relevanceLabels: relevance.labels,
          priorityLabel: relevance.priorityLabel,
        };
        const liquidation = toFrontendLiquidation(enriched);
        state.liquidations = [liquidation, ...state.liquidations.filter((item) => item.id !== liquidation.id)].slice(0, 120);
        publish("liquidation", liquidation);
      },
    });
    stopOkxLiquidations = createOkxLiquidationEventStream({
      logger,
      minUsd: 5_000,
      onEvent(rawEvent) {
        const normalized = whaleEngine.normalize(rawEvent);
        if (!normalized) return;
        const relevance = relevanceEngine.score(normalized.relatedAssets, { priorityScore: normalized.significance });
        const enriched = {
          ...normalized,
          watchlistRelevance: relevance.score,
          relevanceLabels: relevance.labels,
          priorityLabel: relevance.priorityLabel,
        };
        const liquidation = toFrontendLiquidation(enriched);
        state.liquidations = [liquidation, ...state.liquidations.filter((item) => item.id !== liquidation.id)].slice(0, 120);
        publish("liquidation", liquidation);
      },
    });

    stopWhaleTape = createBinanceLargeTradeStream({
      logger,
      symbols: (config.whaleFallback?.symbols || ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"])
        .map((s) => String(s || "").toLowerCase()),
      minUsd: whaleMinUsd,
      onEvent(rawEvent) {
        const normalized = whaleEngine.normalize(rawEvent);
        if (!normalized) return;
        if (!canPublishWhaleEvent(normalized)) return;
        const relevance = relevanceEngine.score(normalized.relatedAssets, { priorityScore: normalized.significance });
        const enriched = {
          ...normalized,
          watchlistRelevance: relevance.score,
          relevanceLabels: relevance.labels,
          priorityLabel: relevance.priorityLabel,
        };
        const whale = toFrontendWhaleItem(enriched);
        state.whales = [whale, ...state.whales.filter((item) => item.id !== whale.id)].slice(0, 80);
        state.whaleEvents = [enriched, ...state.whaleEvents.filter((item) => item.id !== enriched.id)].slice(0, 120);
        publish("whales", state.whales);
        publish("whaleEvents", state.whaleEvents);
      },
    });
    stopBybitWhaleTape = createBybitLargeTradeStream({
      logger,
      symbols: (config.whaleFallback?.symbols || ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"])
        .map((s) => String(s || "").toUpperCase()),
      minUsd: whaleMinUsd,
      onEvent(rawEvent) {
        const normalized = whaleEngine.normalize(rawEvent);
        if (!normalized) return;
        if (!canPublishWhaleEvent(normalized)) return;
        const relevance = relevanceEngine.score(normalized.relatedAssets, { priorityScore: normalized.significance });
        const enriched = {
          ...normalized,
          watchlistRelevance: relevance.score,
          relevanceLabels: relevance.labels,
          priorityLabel: relevance.priorityLabel,
        };
        const whale = toFrontendWhaleItem(enriched);
        state.whales = [whale, ...state.whales.filter((item) => item.id !== whale.id)].slice(0, 80);
        state.whaleEvents = [enriched, ...state.whaleEvents.filter((item) => item.id !== enriched.id)].slice(0, 120);
        publish("whales", state.whales);
        publish("whaleEvents", state.whaleEvents);
      },
    });
    stopOkxWhaleTape = createOkxLargeTradeStream({
      logger,
      symbols: ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "SOL-USDT-SWAP", "BNB-USDT-SWAP", "XRP-USDT-SWAP"],
      minUsd: whaleMinUsd,
      onEvent(rawEvent) {
        const normalized = whaleEngine.normalize(rawEvent);
        if (!normalized) return;
        if (!canPublishWhaleEvent(normalized)) return;
        const relevance = relevanceEngine.score(normalized.relatedAssets, { priorityScore: normalized.significance });
        const enriched = {
          ...normalized,
          watchlistRelevance: relevance.score,
          relevanceLabels: relevance.labels,
          priorityLabel: relevance.priorityLabel,
        };
        const whale = toFrontendWhaleItem(enriched);
        state.whales = [whale, ...state.whales.filter((item) => item.id !== whale.id)].slice(0, 80);
        state.whaleEvents = [enriched, ...state.whaleEvents.filter((item) => item.id !== enriched.id)].slice(0, 120);
        publish("whales", state.whales);
        publish("whaleEvents", state.whaleEvents);
      },
    });

    if (featureFlags.enableNewsTreeWs !== false && config.treeNewsApiKey) {
      stopTreeNews = createTreeOfAlphaNewsStream({
        apiKey: config.treeNewsApiKey,
        logger,
        onEvent(newsEvent) {
          const item = toFrontendNewsItem({
            id: newsEvent.id,
            title: newsEvent.title,
            summary: newsEvent.summary,
            source: newsEvent.source,
            sourceType: newsEvent.sourceType || "news",
            sentiment: newsEvent.sentiment || "neutral",
            importance: newsEvent.importance || "watch",
            tickers: newsEvent.tickers || [],
            relatedAssets: newsEvent.tickers || [],
            watchlistRelevance: 0,
            relevanceLabels: [],
            priorityLabel: "watchlist hit",
            timestamp: newsEvent.timestamp,
            url: newsEvent.url || "#",
          });
          if (item.type === "social") {
            state.social = [item, ...state.social.filter((row) => row.id !== item.id)].slice(0, 80);
            publish("social", state.social);
            return;
          }
          state.news = [item, ...state.news.filter((row) => row.id !== item.id)].slice(0, 160);
          publish("news", item);
        },
      });
    } else {
      stopTreeNews = null;
    }
  }

  async function refreshSecondaryStats() {
    const [mempoolStats, fearGreed, ethGas, defiTvl, forex, venueQuotes] = await Promise.all([
      getMempoolStats(),
      getFearGreed(),
      getEthGas(config.etherscanApiKey),
      getDefiLlamaTvl(),
      getForexRates(),
      getVenueQuotes(),
    ]);

    state.mempoolStats = mempoolStats;
    state.fearGreed = fearGreed;
    state.ethGas = ethGas;
    state.defiTvl = defiTvl;
    state.forex = forex;
    state.venueQuotes = venueQuotes;

    publish("mempoolStats", state.mempoolStats);
    publish("fearGreed", state.fearGreed);
    publish("ethGas", state.ethGas);
    publish("defiTvl", state.defiTvl);
    publish("forex", state.forex);
    publish("venueQuotes", state.venueQuotes);
  }

  async function refreshAll() {
    await Promise.all([
      refreshMarketLayer(),
      refreshCoinMetadataLayer(),
      refreshDiscoveryLayer(),
      refreshNewsLayer(),
      refreshWhaleLayer(),
      refreshSecondaryStats(),
    ]);
    if (state.quotes.length > 0) {
      updateConnectionState();
    }
  }

  function getSnapshot() {
    return {
      ...state,
      providerState: { ...providerState },
      providerHealth: { ...providerHealth },
      newsSourceHealth: { ...newsSourceHealth },
      freshness: buildFreshnessSummary(),
    };
  }

  function filterNews(filters = {}) {
    const ticker = canonicalSymbol(filters.ticker);
    const keyword = filters.keyword ? String(filters.keyword).toLowerCase() : "";
    const sector = filters.sector ? String(filters.sector) : "";

    const filtered = state.news.filter((item) => {
      if (ticker && !item.ticker.includes(ticker)) return false;
      if (sector && sector !== "All" && !String(item.sector || "").includes(sector)) return false;
      if (keyword && !`${item.headline} ${item.summary} ${item.source}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
    return filtered.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp) || b.id.localeCompare(a.id));
  }

  function buildFreshnessSummary() {
    const now = Date.now();
    const newestNewsTs = state.news.length > 0 ? toMs(state.news[0]?.timestamp) : 0;
    const newestSocialTs = state.social.length > 0 ? toMs(state.social[0]?.timestamp) : 0;
    const newsFetchedTs = maxTimestamp([
      newsSourceHealth.rss?.lastSuccessAt,
      newsSourceHealth.json?.lastSuccessAt,
      newsSourceHealth.exchange_announcements?.lastSuccessAt,
      newsSourceHealth.tree?.lastSuccessAt,
      newsSourceHealth.ninja?.lastSuccessAt,
    ]);
    const socialFetchedTs = maxTimestamp([
      newsSourceHealth.social_rss?.lastSuccessAt,
      newsSourceHealth.tree?.lastSuccessAt,
      newsSourceHealth.ninja?.lastSuccessAt,
    ]);
    const newsAgeSec = newestNewsTs > 0 ? Math.max(0, Math.round((now - newestNewsTs) / 1000)) : null;
    const socialAgeSec = newestSocialTs > 0 ? Math.max(0, Math.round((now - newestSocialTs) / 1000)) : null;
    const newsFetchAgeSec = newsFetchedTs > 0 ? Math.max(0, Math.round((now - newsFetchedTs) / 1000)) : null;
    const socialFetchAgeSec = socialFetchedTs > 0 ? Math.max(0, Math.round((now - socialFetchedTs) / 1000)) : null;
    const newsFreshWindowSec = Math.max(180, Number(ttl.newsFreshWindowSec) || 900);
    const socialFreshWindowSec = Math.max(180, Number(ttl.socialFreshWindowSec) || 900);
    const fetchHeartbeatSec = Math.max(180, Math.round((Number(ttl.newsFeedMs) || 45_000) * 3 / 1000));
    const newsFresh =
      (newsAgeSec != null && newsAgeSec <= newsFreshWindowSec) ||
      (newsFetchAgeSec != null && newsFetchAgeSec <= fetchHeartbeatSec);
    const socialFresh =
      (socialAgeSec != null && socialAgeSec <= socialFreshWindowSec) ||
      (socialFetchAgeSec != null && socialFetchAgeSec <= fetchHeartbeatSec);
    return {
      newsAgeSec,
      socialAgeSec,
      newsFetchAgeSec,
      socialFetchAgeSec,
      newsFresh,
      socialFresh,
      stale: !(newsFresh || socialFresh),
    };
  }

  function getLiquidations(limit = 20) {
    const capped = Math.max(1, Math.min(Number(limit) || 20, 100));
    const liquidations = state.liquidations.slice(0, capped).map((event) => ({
      id: event.id,
      symbol: `${event.symbol}USDT`,
      displaySymbol: event.symbol,
      side: event.side === "long" ? "LONG" : "SHORT",
      sizeUSD: event.usdValue,
      quantity: event.qty,
      price: event.price,
      exchange: "Binance",
      timestamp: event.timestamp,
    }));
    const stats = liquidations.reduce(
      (acc, row) => {
        acc.totalUSD += row.sizeUSD;
        if (row.side === "LONG") acc.longUSD += row.sizeUSD;
        if (row.side === "SHORT") acc.shortUSD += row.sizeUSD;
        acc.count += 1;
        return acc;
      },
      { totalUSD: 0, longUSD: 0, shortUSD: 0, count: 0 },
    );
    return { liquidations, stats };
  }

  function getEventAnalysis({ kind, id }) {
    if (!id) return null;
    if (kind === "whale") {
      const event = state.whaleEvents.find((item) => item.id === id);
      if (!event) return null;
      const analysis = analysisEngine.analyzeWhale(event);
      state.selectedEventAnalysis = analysis;
      return analysis;
    }
    const item = (state.newsSnapshot.items || []).find((entry) => entry.id === id);
    if (!item) return null;
    const analysis = analysisEngine.analyzeNews(item);
    state.selectedEventAnalysis = analysis;
    return analysis;
  }

  async function start() {
    if (started) return;
    started = true;

    await refreshAll().catch((error) => {
      logger?.warn?.("data.service.bootstrap_failed", { error: String(error) });
    });
    startStreamingAdapters();

    intervals = [
      setInterval(() => void refreshMarketLayer().catch(() => {}), ttl.marketSnapshotMs || 20_000),
      setInterval(() => void refreshCoinMetadataLayer().catch(() => {}), ttl.coinMetadataMs || 6 * 60 * 60 * 1000),
      setInterval(() => void refreshDiscoveryLayer().catch(() => {}), ttl.discoveryMs || 45_000),
      setInterval(() => void refreshNewsLayer().catch(() => {}), ttl.newsFeedMs || 60_000),
      setInterval(() => void refreshWhaleLayer().catch(() => {}), ttl.whaleScanMs || 75_000),
      setInterval(() => void refreshSecondaryStats().catch(() => {}), 30_000),
      setInterval(() => publish("heartbeat", { ok: true, ts: Date.now() }), 10_000),
    ];
  }

  function stop() {
    if (!started) return;
    started = false;
    if (stopHyperliquid) stopHyperliquid();
    if (stopBinanceQuotes) stopBinanceQuotes();
    if (stopOkxQuotes) stopOkxQuotes();
    if (stopBybitQuotes) stopBybitQuotes();
    if (stopLiquidations) stopLiquidations();
    if (stopBybitLiquidations) stopBybitLiquidations();
    if (stopOkxLiquidations) stopOkxLiquidations();
    if (stopWhaleTape) stopWhaleTape();
    if (stopBybitWhaleTape) stopBybitWhaleTape();
    if (stopOkxWhaleTape) stopOkxWhaleTape();
    if (stopTreeNews) stopTreeNews();
    stopHyperliquid = null;
    stopBinanceQuotes = null;
    stopOkxQuotes = null;
    stopBybitQuotes = null;
    stopLiquidations = null;
    stopBybitLiquidations = null;
    stopOkxLiquidations = null;
    stopWhaleTape = null;
    stopBybitWhaleTape = null;
    stopOkxWhaleTape = null;
    stopTreeNews = null;
    intervals.forEach(clearInterval);
    intervals = [];
  }

  return {
    start,
    stop,
    events,
    getSnapshot,
    refreshAll,
    getNews: filterNews,
    getNewsSnapshot: () => state.newsSnapshot,
    getWhales: () => state.whales,
    getWhaleEvents: () => state.whaleEvents,
    getSocial: () => state.social,
    getLiquidations,
    getEventAnalysis,
    getStatus: () => ({
      started,
      providerState: { ...providerState },
      providerHealth: { ...providerHealth },
      newsSourceHealth: { ...newsSourceHealth },
      freshness: buildFreshnessSummary(),
      quotes: state.quotes.length,
      news: state.news.length,
      whales: state.whales.length,
      whaleEvents: state.whaleEvents.length,
      liquidations: state.liquidations.length,
    }),
  };
}
