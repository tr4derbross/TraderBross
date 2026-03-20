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
import { fetchTreeOfAlphaNews } from "./adapters/news-treeofalpha.adapter.mjs";
import { createTreeOfAlphaNewsStream } from "./adapters/news-treeofalpha.adapter.mjs";
import { createLiquidationEventStream, fetchOnchainWhaleEvents } from "./adapters/onchain-whale-events.adapter.mjs";
import { fetchCoingeckoCoinMetadata } from "./adapters/coingecko-metadata.adapter.mjs";
import { fetchCoinpaprikaCoinMetadata } from "./adapters/coinpaprika-metadata.adapter.mjs";
import { fetchBinanceLargeTradeEvents } from "./adapters/whale-binance-trades.adapter.mjs";
import { createNewsIngestionEngine } from "./news/news-engine.mjs";
import { createWhaleEventEngine } from "./onchain/whale-engine.mjs";
import { createWatchlistRelevance } from "./core/watchlist-relevance.mjs";
import { createRuleAnalysisEngine } from "./analysis/rule-analysis.mjs";
import { getVenueQuotes } from "../services/venue-service.mjs";
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

export function createTerminalDataService({ config, logger }) {
  const cache = new TtlCache();
  const limiter = new SlidingWindowRateLimiter({ limit: 120, windowMs: 60_000 });
  const events = createEventBus();
  const featureFlags = config.featureFlags || {};
  const ttl = config.dataTtl || {};
  const coreSymbols = CORE_SYMBOLS.slice(0, 22);
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

  let started = false;
  let stopHyperliquid = null;
  let stopLiquidations = null;
  let stopTreeNews = null;
  let intervals = [];

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

  async function callWithFallback({ cacheKey, ttlMs, staleMs, limiterKey, primary, fallback, providerName }) {
    const cacheResult = await cache.remember(cacheKey, { ttlMs, staleMs }, async () => {
      try {
        markProvider(providerName, "fetching");
        providerHealth[providerName].providerCalls += 1;
        const value = await runRateLimited(limiter, limiterKey, primary);
        markProvider(providerName, "ok");
        return value;
      } catch (primaryError) {
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
    const treeEnabled = featureFlags.enableNewsTree !== false;
    if (!rssEnabled && !jsonEnabled && !treeEnabled) {
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
        const mergedSocialFeeds = Array.from(dedupedFeedMap.values()).slice(0, 24);
        const [rss, json, tree, social] = await Promise.all([
          rssEnabled ? fetchRssNews() : Promise.resolve([]),
          jsonEnabled ? fetchJsonNews({ cryptopanicKey: config.cryptopanicKey }) : Promise.resolve([]),
          treeEnabled ? fetchTreeOfAlphaNews({ limit: ttl.treeNewsLimit || 300 }) : Promise.resolve([]),
          mergedSocialFeeds.length > 0 ? fetchRssNews({ feeds: mergedSocialFeeds }) : Promise.resolve([]),
        ]);
        const socialRows = social.map((item) => ({ ...item, sourceType: "social" }));
        const treeRows = (Array.isArray(tree) ? tree : []).map((item) => ({
          ...item,
          sourceType: item.sourceType || "news",
        }));
        const engineSnapshot = newsEngine.ingest([...rss, ...json, ...treeRows, ...socialRows]);
        if (engineSnapshot.count === 0) {
          const errors = [];
          if (rssEnabled && rss.length === 0) errors.push("rss_empty_or_unavailable");
          if (jsonEnabled && json.length === 0) errors.push("json_empty_or_unavailable");
          if (treeEnabled && treeRows.length === 0) errors.push("tree_news_empty_or_unavailable");
          if (mergedSocialFeeds.length > 0 && socialRows.length === 0) errors.push("social_rss_empty_or_unavailable");
          engineSnapshot.errors = errors;
        }
        return engineSnapshot;
      },
      fallback: async () => state.newsSnapshot,
    });

    const snapshot = result.value || {
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
    const nextPrimaryNews = nextNews.filter((item) => item.type !== "social");
    const nextSocial = nextNews.filter((item) => item.type === "social").slice(0, 80);
    const prevIds = new Set(state.news.map((item) => item.id));
    state.news = nextPrimaryNews;
    state.social = nextSocial;

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
      ? () => fetchOnchainWhaleEvents({ whaleAlertKey: config.whaleAlertKey })
      : () =>
          fetchBinanceLargeTradeEvents({
            minUsd: config.whaleFallback?.minUsd || 500_000,
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
    };
  }

  function filterNews(filters = {}) {
    const ticker = canonicalSymbol(filters.ticker);
    const keyword = filters.keyword ? String(filters.keyword).toLowerCase() : "";
    const sector = filters.sector ? String(filters.sector) : "";

    return state.news.filter((item) => {
      if (ticker && !item.ticker.includes(ticker)) return false;
      if (sector && sector !== "All" && !String(item.sector || "").includes(sector)) return false;
      if (keyword && !`${item.headline} ${item.summary} ${item.source}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
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
    if (stopLiquidations) stopLiquidations();
    if (stopTreeNews) stopTreeNews();
    stopHyperliquid = null;
    stopLiquidations = null;
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
      quotes: state.quotes.length,
      news: state.news.length,
      whales: state.whales.length,
      whaleEvents: state.whaleEvents.length,
      liquidations: state.liquidations.length,
    }),
  };
}
