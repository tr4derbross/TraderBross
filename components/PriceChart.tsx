"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { AVAILABLE_TICKERS, type NewsItem } from "@/lib/mock-data";
import type { TradingVenueId } from "@/lib/active-venue";
import { MarginMode, Order, OrderType, Position, Side } from "@/hooks/useTradingState";
import { apiFetch } from "@/lib/api-client";

type FundingVenue = {
  venue: "Binance" | "OKX" | "Bybit";
  rate: number | null;
  nextFundingTime: number | null;
  intervalHours: number | null;
  status: "live" | "unavailable";
};

type FundingApiRow = {
  symbol?: string;
  fundingRate?: string | number | null;
  nextFundingTime?: string | number | null;
};

type PriceData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W";
type ChartType = "candles" | "line";
type ChartMenu = { x: number; y: number; price: number } | null;
type MarkerPosition = "aboveBar" | "belowBar";
type MarkerShape = "circle" | "square" | "arrowUp" | "arrowDown";
const ENABLE_CHART_TPSL_DRAG = false;

type Props = {
  activeVenue: TradingVenueId;
  activeSymbol: string;
  availableTickers?: string[];
  quoteAsset?: "USDT" | "USDC";
  marketDataSourceLabel: string;
  liveTickerPrice?: number;
  liveFeedConnected?: boolean;
  selectedEvent?: NewsItem | null;
  eventItems?: NewsItem[];
  positions?: Position[];
  orders?: Order[];
  onUpdatePositionTpSl?: (posId: string, tp: number | undefined, sl: number | undefined) => void;
  onTickerChange?: (ticker: string) => void;
  onPlaceOrder?: (
    ticker: string,
    side: Side,
    type: OrderType,
    marginAmount: number,
    leverage: number,
    marginMode: MarginMode,
    limitPrice?: number,
    tpPrice?: number,
    slPrice?: number,
  ) => boolean | void;
};

const TF_CONFIG: Record<Timeframe, { interval: string; label: string; limit: number }> = {
  "1m": { interval: "1m", label: "1m", limit: 240 },
  "5m": { interval: "5m", label: "5m", limit: 240 },
  "15m": { interval: "15m", label: "15m", limit: 240 },
  "30m": { interval: "30m", label: "30m", limit: 240 },
  "1H": { interval: "1h", label: "1H", limit: 240 },
  "4H": { interval: "4h", label: "4H", limit: 200 },
  "1D": { interval: "1d", label: "1D", limit: 180 },
  "1W": { interval: "1w", label: "1W", limit: 100 },
};

function fmtFunding(rate: number | null): string {
  if (rate === null) return "N/A";
  return `${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(4)}%`;
}

function fmtFundingEta(nextFundingTime: number | null): string {
  if (!nextFundingTime) return "No ETA";
  const diffMs = nextFundingTime - Date.now();
  if (diffMs <= 0) return "Due";
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function fmtPrice(value: number): string {
  if (value >= 10000) return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

function fmtVol(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function isValidProtectiveLevel(
  side: Side,
  entryPrice: number,
  target: "tp" | "sl",
  candidatePrice: number
) {
  if (candidatePrice <= 0) return false;

  if (target === "tp") {
    return side === "long" ? candidatePrice > entryPrice : candidatePrice < entryPrice;
  }

  return side === "long" ? candidatePrice < entryPrice : candidatePrice > entryPrice;
}

export default function PriceChart({
  activeVenue,
  activeSymbol,
  availableTickers = AVAILABLE_TICKERS,
  quoteAsset = "USDT",
  marketDataSourceLabel,
  liveTickerPrice,
  liveFeedConnected = false,
  selectedEvent = null,
  eventItems = [],
  positions = [],
  orders = [],
  onUpdatePositionTpSl,
  onTickerChange,
  onPlaceOrder,
}: Props) {
  const chartShellRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);
  const mainSeriesRef = useRef<unknown>(null);
  const volumeSeriesRef = useRef<unknown>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const entryLineRef = useRef<unknown>(null);
  const liqLineRef = useRef<unknown>(null);
  const tpLineRef = useRef<unknown>(null);
  const slLineRef = useRef<unknown>(null);
  const openOrderLinesRef = useRef<unknown[]>([]);
  const ticker = activeSymbol;
  const chartTickers = availableTickers.length > 0 ? availableTickers : AVAILABLE_TICKERS;

  const [isMobile, setIsMobile] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fundingRates, setFundingRates] = useState<FundingVenue[]>([]);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [hoveredBar, setHoveredBar] = useState<PriceData | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragTarget, setDragTarget] = useState<"tp" | "sl" | null>(null);
  const [dragPreviewPrice, setDragPreviewPrice] = useState<number | null>(null);
  const [menu, setMenu] = useState<ChartMenu>(null);
  const [eventFocusArmed, setEventFocusArmed] = useState(false);
  const lastAutoFocusedEventRef = useRef<string | null>(null);
  const hasFittedRef = useRef(false);
  const hoverRafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<PriceData | null>(null);
  const activePosition = positions.find((position) => position.ticker === ticker);
  const effectiveTpPrice =
    dragTarget === "tp" && dragPreviewPrice && dragPreviewPrice > 0
      ? dragPreviewPrice
      : activePosition?.tpPrice;
  const effectiveSlPrice =
    dragTarget === "sl" && dragPreviewPrice && dragPreviewPrice > 0
      ? dragPreviewPrice
      : activePosition?.slPrice;
  const openOrders = orders.filter((order) => order.status === "open" && order.ticker === ticker);
  const lastBar = priceData[priceData.length - 1] ?? null;
  const firstBar = priceData[0] ?? null;
  const displayBar = hoveredBar ?? lastBar;
  const isUp = displayBar ? displayBar.close >= displayBar.open : true;
  const change = lastBar && firstBar ? ((lastBar.close - firstBar.close) / firstBar.close) * 100 : null;
  const vol = priceData.reduce((sum, item) => sum + item.volume, 0);
  const recentRelatedEvent = useMemo(
    () =>
      [...eventItems]
        .filter((item) => item.ticker?.includes(ticker))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null,
    [eventItems, ticker],
  );

  const clearPriceLine = (lineRef: React.MutableRefObject<unknown>) => {
    if (!mainSeriesRef.current || !lineRef.current) return;
    try {
      (mainSeriesRef.current as { removePriceLine: (line: unknown) => void }).removePriceLine(lineRef.current);
    } catch {
      /* ignore */
    }
    lineRef.current = null;
  };

  const clearOpenOrderLines = () => {
    if (!mainSeriesRef.current || openOrderLinesRef.current.length === 0) return;

    const series = mainSeriesRef.current as { removePriceLine: (line: unknown) => void };
    openOrderLinesRef.current.forEach((line) => {
      try {
        series.removePriceLine(line);
      } catch {
        /* ignore */
      }
    });
    openOrderLinesRef.current = [];
  };

  const priceToCoordinate = (price: number) => {
    if (!mainSeriesRef.current) return null;
    try {
      return (mainSeriesRef.current as { priceToCoordinate: (value: number) => number | null }).priceToCoordinate(price);
    } catch {
      return null;
    }
  };

  const coordinateToPrice = (coordinate: number) => {
    if (!chartRef.current) return null;
    try {
      return (chartRef.current as { priceScale: (id: string) => { coordinateToPrice: (value: number) => number | null } })
        .priceScale("right")
        .coordinateToPrice(coordinate);
    } catch {
      return null;
    }
  };

  const fitChart = () => {
    try {
      (chartRef.current as { timeScale: () => { fitContent: () => void } })?.timeScale().fitContent();
    } catch {
      /* ignore */
    }
  };

  const getTimeframeSeconds = (value: Timeframe) => {
    switch (value) {
      case "1m": return 60;
      case "5m": return 5 * 60;
      case "15m": return 15 * 60;
      case "30m": return 30 * 60;
      case "1H": return 60 * 60;
      case "4H": return 4 * 60 * 60;
      case "1D": return 24 * 60 * 60;
      case "1W": return 7 * 24 * 60 * 60;
      default: return 5 * 60;
    }
  };

  const parseEventTime = (value: NewsItem["timestamp"]) => {
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return null;
    return Math.floor(ts / 1000);
  };

  const snapToNearestBar = (eventTimeSec: number) => {
    if (priceData.length === 0) return null;
    let nearest = priceData[0].time;
    let minDiff = Math.abs(nearest - eventTimeSec);
    for (let i = 1; i < priceData.length; i += 1) {
      const time = priceData[i].time;
      const diff = Math.abs(time - eventTimeSec);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = time;
      }
    }
    return nearest;
  };

  const focusOnEvent = (item: NewsItem | null) => {
    if (!item || !chartRef.current || priceData.length < 8) return;
    if (!item.ticker?.includes(ticker)) return;
    const eventTime = parseEventTime(item.timestamp);
    if (!eventTime) return;
    const snapped = snapToNearestBar(eventTime);
    if (!snapped) return;
    const tfSec = getTimeframeSeconds(timeframe);
    const halfWindow = Math.max(tfSec * 28, 60 * 20);
    try {
      (chartRef.current as { timeScale: () => { setVisibleRange: (range: { from: number; to: number }) => void } })
        .timeScale()
        .setVisibleRange({ from: snapped - halfWindow, to: snapped + halfWindow });
      setEventFocusArmed(true);
    } catch {
      /* ignore */
    }
  };

  const chartMarkers = useMemo(() => {
    if (priceData.length === 0) return [];
    const seen = new Set<string>();
    const merged = [
      ...(selectedEvent ? [selectedEvent] : []),
      ...eventItems.filter((item) => item.ticker?.includes(ticker)),
    ];
    const result: Array<{
      time: number;
      position: MarkerPosition;
      color: string;
      shape: MarkerShape;
      text: string;
    }> = [];

    for (const item of merged) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const parsed = parseEventTime(item.timestamp);
      if (!parsed) continue;
      const snapped = snapToNearestBar(parsed);
      if (!snapped) continue;
      const isWhale = item.type === "whale";
      const isSelected = selectedEvent?.id === item.id;
      result.push({
        time: snapped,
        position: isWhale ? "aboveBar" : "belowBar",
        color: isSelected ? "#f0b90b" : isWhale ? "#f59e0b" : "#60a5fa",
        shape: isSelected ? "circle" : isWhale ? "arrowDown" : "arrowUp",
        text: isSelected ? "Selected" : isWhale ? "Whale" : "News",
      });
      if (result.length >= 18) break;
    }

    return result.sort((a, b) => a.time - b.time);
  }, [eventItems, priceData, selectedEvent, ticker]);

  // Track mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      requestAnimationFrame(() => {
        const chart = chartRef.current as { applyOptions?: (options: { width: number; height: number }) => void } | null;
        const el = chartContainerRef.current;
        if (chart?.applyOptions && el) {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
        }
      });
    };
    const closeMenu = () => setMenu(null);

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("click", closeMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("click", closeMenu);
    };
  }, []);

  useEffect(() => {
    setMenu(null);
    setDragTarget(null);
    setDragPreviewPrice(null);
    setHoveredBar(null);
    setEventFocusArmed(false);
    hasFittedRef.current = false;
  }, [activeVenue, ticker]);

  useEffect(() => {
    let active = true;

    apiFetch<{ rates?: FundingVenue[] } | FundingApiRow[]>(`/api/funding?ticker=${ticker}`)
      .then((payload) => {
        if (!active) return;
        if (Array.isArray(payload)) {
          const normalizedTicker = String(ticker || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          const match =
            payload.find((row) => String(row.symbol || "").toUpperCase() === `${normalizedTicker}USDT`) ??
            payload.find((row) => String(row.symbol || "").toUpperCase() === `${normalizedTicker}USDC`) ??
            payload[0];
          const rate = Number(match?.fundingRate ?? NaN);
          const nextFundingTime = Number(match?.nextFundingTime ?? NaN);
          setFundingRates([
            {
              venue: "Binance",
              rate: Number.isFinite(rate) ? rate : null,
              nextFundingTime: Number.isFinite(nextFundingTime) ? nextFundingTime : null,
              intervalHours: 8,
              status: Number.isFinite(rate) ? "live" : "unavailable",
            },
          ]);
          return;
        }
        setFundingRates(Array.isArray(payload.rates) ? payload.rates : []);
      })
      .catch(() => {
        if (active) setFundingRates([]);
      });

    return () => {
      active = false;
    };
  }, [ticker]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    let disposed = false;
    setChartReady(false);

    const initChart = async () => {
      const lwc = await import("lightweight-charts");
      if (disposed || !chartContainerRef.current) return;
      setChartError(null);

      const chart = lwc.createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth || 900,
        height: chartContainerRef.current.clientHeight || 620,
        layout: {
          background: { color: "#06080d" },
          textColor: "#7c8292",
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.05)" },
          horzLines: { color: "rgba(255,255,255,0.05)" },
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.08)",
          scaleMargins: { top: 0.08, bottom: 0.2 },
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.08)",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 8,
          barSpacing: 8,
        },
        crosshair: {
          mode: 1,
          vertLine: { color: "rgba(240,185,11,0.35)", style: 2 },
          horzLine: { color: "rgba(240,185,11,0.22)", style: 2 },
        },
      });

      const volumeSeries = chart.addSeries(lwc.HistogramSeries, {
        priceScaleId: "volume",
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      if (chartType === "candles") {
        mainSeriesRef.current = chart.addSeries(lwc.CandlestickSeries, {
          upColor: "#0ecb81",
          downColor: "#f6465d",
          borderUpColor: "#0ecb81",
          borderDownColor: "#f6465d",
          wickUpColor: "#0ecb81",
          wickDownColor: "#f6465d",
          priceLineVisible: true,
          priceLineColor: "#f0b90b",
        });
      } else {
        mainSeriesRef.current = chart.addSeries(lwc.LineSeries, {
          color: "#f0b90b",
          lineWidth: 2,
          priceLineVisible: true,
          priceLineColor: "#f0b90b",
          crosshairMarkerVisible: true,
        });
      }

      chart.subscribeCrosshairMove((param) => {
        const commitHover = (bar: PriceData | null) => {
          pendingHoverRef.current = bar;
          if (hoverRafRef.current !== null) return;
          hoverRafRef.current = window.requestAnimationFrame(() => {
            hoverRafRef.current = null;
            setHoveredBar(pendingHoverRef.current);
          });
        };
        if (!param.time || !mainSeriesRef.current) {
          commitHover(null);
          return;
        }

        if (chartType === "candles") {
          const point = param.seriesData.get(mainSeriesRef.current as never) as { open: number; high: number; low: number; close: number } | undefined;
          const volumePoint = param.seriesData.get(volumeSeries as never) as { value: number } | undefined;
          if (!point) {
            commitHover(null);
            return;
          }
          commitHover({
            time: typeof param.time === "number" ? param.time : 0,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: volumePoint?.value ?? 0,
          });
        } else {
          const bar = priceData.find((item) => item.time === (typeof param.time === "number" ? param.time : 0)) ?? null;
          commitHover(bar);
        }
      });

      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          chart.applyOptions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });

      resizeObserverRef.current.observe(chartContainerRef.current);
      chartRef.current = chart;
      volumeSeriesRef.current = volumeSeries;
      setChartReady(true);
    };

    initChart().catch(() => {
      if (!disposed) {
        setChartError("Chart engine could not be initialized.");
        setChartReady(false);
      }
    });

    return () => {
      disposed = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (chartRef.current) {
        try {
          (chartRef.current as { remove: () => void }).remove();
        } catch {
          /* ignore */
        }
      }
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      entryLineRef.current = null;
      liqLineRef.current = null;
      tpLineRef.current = null;
      slLineRef.current = null;
      openOrderLinesRef.current = [];
      setChartReady(false);
      if (hoverRafRef.current !== null) {
        window.cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
    };
  }, [chartType]);
  useEffect(() => {
    let active = true;
    const { interval, limit } = TF_CONFIG[timeframe];
    const endpoint =
      activeVenue === "okx"
        ? `/api/okx?type=ohlcv&ticker=${ticker}&quote=${quoteAsset}&interval=${interval}&limit=${limit}`
        : activeVenue === "bybit"
          ? `/api/bybit?type=ohlcv&ticker=${ticker}&quote=${quoteAsset}&interval=${interval}&limit=${limit}`
          : activeVenue === "hyperliquid"
            ? `/api/hyperliquid?type=ohlcv&ticker=${ticker}&interval=${interval}&limit=${limit}`
            : activeVenue === "aster"
              ? `/api/aster?type=ohlcv&ticker=${ticker}&interval=${interval}&limit=${limit}`
              : `/api/prices?ticker=${ticker}&quote=${quoteAsset}&interval=${interval}&limit=${limit}`;

    const fetchCandles = async (mode: "initial" | "refresh") => {
      if (!active) return;
      if (mode === "initial") setIsLoadingPrices(true);
      setChartError(null);

      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(() => {
        if (!active) return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("[PriceChart] chart data timeout for", ticker, timeframe);
        }
        setIsLoadingPrices(false);
        setChartError("Chart data unavailable. Check your connection or try refreshing.");
      }, 10_000);

      try {
        if (process.env.NODE_ENV !== "production") {
          console.log("[PriceChart] fetching candles:", endpoint);
        }
        const payload = await apiFetch<PriceData[]>(endpoint);
        if (!active) return;
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        if (Array.isArray(payload)) {
          setPriceData(payload);
          setChartError(payload.length > 0 ? null : "No candles returned for this symbol/timeframe.");
        } else {
          setChartError("Chart response format is invalid.");
        }
      } catch (err) {
        if (!active) return;
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        console.error("[PriceChart] fetch error for", ticker, err);
        setChartError("Chart data unavailable. Check your connection or try refreshing.");
      } finally {
        if (active) setIsLoadingPrices(false);
      }
    };

    void fetchCandles("initial");
    const pollId = window.setInterval(() => {
      void fetchCandles("refresh");
    }, 25_000);

    return () => {
      active = false;
      window.clearInterval(pollId);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [activeVenue, quoteAsset, ticker, timeframe, refreshNonce]);

  useEffect(() => {
    if (!liveTickerPrice || !Number.isFinite(liveTickerPrice)) return;
    if (!mainSeriesRef.current || priceData.length === 0) return;
    const last = priceData[priceData.length - 1];
    const updated = {
      ...last,
      close: liveTickerPrice,
      high: Math.max(last.high, liveTickerPrice),
      low: Math.min(last.low, liveTickerPrice),
    };
    if (chartType === "candles") {
      (mainSeriesRef.current as { update?: (row: unknown) => void })?.update?.({
        time: updated.time as never,
        open: updated.open,
        high: updated.high,
        low: updated.low,
        close: updated.close,
      });
    } else {
      (mainSeriesRef.current as { update?: (row: unknown) => void })?.update?.({
        time: updated.time as never,
        value: updated.close,
      });
    }
  }, [liveTickerPrice, priceData, chartType]);

  const hasChartData = priceData.length > 0;
  const shouldShowBlockingState = !chartReady || (!isLoadingPrices && !hasChartData);

  useEffect(() => {
    if (!chartReady || !mainSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;

    (volumeSeriesRef.current as { setData: (data: unknown[]) => void }).setData(
      priceData.map((item) => ({
        time: item.time as never,
        value: item.volume,
        color: item.close >= item.open ? "rgba(14,203,129,0.25)" : "rgba(246,70,93,0.25)",
      })),
    );

    if (chartType === "candles") {
      (mainSeriesRef.current as { setData: (data: unknown[]) => void }).setData(
        priceData.map((item) => ({
          time: item.time as never,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        })),
      );
    } else {
      (mainSeriesRef.current as { setData: (data: unknown[]) => void }).setData(
        priceData.map((item) => ({
          time: item.time as never,
          value: item.close,
        })),
      );
    }

    if (!hasFittedRef.current) {
      (chartRef.current as { timeScale: () => { fitContent: () => void } }).timeScale().fitContent();
      hasFittedRef.current = true;
    }
  }, [chartReady, chartType, priceData]);

  useEffect(() => {
    if (!chartReady || !mainSeriesRef.current) return;
    const series = mainSeriesRef.current as { setMarkers?: (markers: unknown[]) => void };
    if (typeof series.setMarkers !== "function") return;
    try {
      series.setMarkers(chartMarkers as unknown[]);
    } catch {
      /* ignore */
    }
  }, [chartMarkers, chartReady, chartType]);

  useEffect(() => {
    if (!chartReady || !selectedEvent || !selectedEvent.ticker?.includes(ticker)) return;
    if (lastAutoFocusedEventRef.current === selectedEvent.id) return;
    lastAutoFocusedEventRef.current = selectedEvent.id;
    focusOnEvent(selectedEvent);
  }, [chartReady, priceData, selectedEvent, ticker, timeframe]);

  useEffect(() => {
    clearPriceLine(entryLineRef);
    clearPriceLine(liqLineRef);
    clearPriceLine(tpLineRef);
    clearPriceLine(slLineRef);

    if (!chartReady || !mainSeriesRef.current || !activePosition) return;

    const series = mainSeriesRef.current as { createPriceLine: (options: Record<string, unknown>) => unknown };
    const isLong = activePosition.side === "long";
    const entryColor = isLong ? "#3b82f6" : "#f97316";

    entryLineRef.current = series.createPriceLine({
      price: activePosition.entryPrice,
      color: entryColor,
      lineWidth: 2,
      lineStyle: 0,
      axisLabelVisible: true,
      title: `${isLong ? "Long" : "Short"} Entry $${fmtPrice(activePosition.entryPrice)}`,
    });

    liqLineRef.current = series.createPriceLine({
      price: activePosition.liquidationPrice,
      color: "#f0b90b",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `Liq $${fmtPrice(activePosition.liquidationPrice)}`,
    });

    if (effectiveTpPrice) {
      tpLineRef.current = series.createPriceLine({
        price: effectiveTpPrice,
        color: "#0ecb81",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `TP $${fmtPrice(effectiveTpPrice)}`,
      });
    }

    if (effectiveSlPrice) {
      slLineRef.current = series.createPriceLine({
        price: effectiveSlPrice,
        color: "#f6465d",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `SL $${fmtPrice(effectiveSlPrice)}`,
      });
    }
  }, [activePosition, chartReady, chartType, effectiveTpPrice, effectiveSlPrice]);

  useEffect(() => {
    clearOpenOrderLines();

    if (!chartReady || !mainSeriesRef.current || openOrders.length === 0) return;

    const series = mainSeriesRef.current as { createPriceLine: (options: Record<string, unknown>) => unknown };

    openOrderLinesRef.current = openOrders.map((order) =>
      series.createPriceLine({
        price: order.price,
        color:
          order.type === "stop"
            ? order.side === "long"
              ? "rgba(245,158,11,0.95)"
              : "rgba(244,63,94,0.95)"
            : order.side === "long"
              ? "rgba(59,130,246,0.95)"
              : "rgba(168,85,247,0.95)",
        lineWidth: 1,
        lineStyle: order.type === "stop" ? 2 : 1,
        axisLabelVisible: true,
        title: `${order.side.toUpperCase()} ${order.type.toUpperCase()} $${fmtPrice(order.price)}`,
      })
    );

    return () => {
      clearOpenOrderLines();
    };
  }, [chartReady, openOrders]);

  useEffect(() => {
    if (!ENABLE_CHART_TPSL_DRAG) return;
    const shell = chartShellRef.current;
    const container = chartContainerRef.current;
    if (!shell || !container || !activePosition || !onUpdatePositionTpSl) return;

    const hitZone = 10;

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const y = event.clientY - rect.top;

      if (dragTarget) {
        const draggedPrice = coordinateToPrice(y);
        if (
          !draggedPrice ||
          !isValidProtectiveLevel(activePosition.side, activePosition.entryPrice, dragTarget, draggedPrice)
        ) {
          container.style.cursor = "not-allowed";
          return;
        }
        container.style.cursor = "ns-resize";
        setDragPreviewPrice(draggedPrice);
        return;
      }

      const tpY = effectiveTpPrice ? priceToCoordinate(effectiveTpPrice) : null;
      const slY = effectiveSlPrice ? priceToCoordinate(effectiveSlPrice) : null;
      const nearTp = tpY !== null && Math.abs(y - tpY) < hitZone;
      const nearSl = slY !== null && Math.abs(y - slY) < hitZone;
      container.style.cursor = nearTp || nearSl ? "ns-resize" : "";
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const rect = container.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const tpY = effectiveTpPrice ? priceToCoordinate(effectiveTpPrice) : null;
      const slY = effectiveSlPrice ? priceToCoordinate(effectiveSlPrice) : null;

      if (tpY !== null && Math.abs(y - tpY) < hitZone) {
        setDragTarget("tp");
        setDragPreviewPrice(effectiveTpPrice ?? activePosition.entryPrice);
        event.preventDefault();
        return;
      }

      if (slY !== null && Math.abs(y - slY) < hitZone) {
        setDragTarget("sl");
        setDragPreviewPrice(effectiveSlPrice ?? activePosition.entryPrice);
        event.preventDefault();
      }
    };

    const onMouseUp = () => {
      if (dragTarget && dragPreviewPrice && dragPreviewPrice > 0) {
        onUpdatePositionTpSl(
          activePosition.id,
          dragTarget === "tp" ? dragPreviewPrice : activePosition.tpPrice,
          dragTarget === "sl" ? dragPreviewPrice : activePosition.slPrice,
        );
      }
      setDragTarget(null);
      setDragPreviewPrice(null);
      container.style.cursor = "";
    };

    shell.addEventListener("mousemove", onMouseMove);
    shell.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      shell.removeEventListener("mousemove", onMouseMove);
      shell.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      container.style.cursor = "";
    };
  }, [activePosition, dragTarget, dragPreviewPrice, onUpdatePositionTpSl, effectiveTpPrice, effectiveSlPrice]);

  const toggleFullscreen = async () => {
    if (typeof document === "undefined") return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await chartShellRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const applyQuickPositionUpdate = (target: "tp" | "sl", price: number) => {
    if (!activePosition || !onUpdatePositionTpSl || price <= 0) return;
    onUpdatePositionTpSl(
      activePosition.id,
      target === "tp" ? price : activePosition.tpPrice,
      target === "sl" ? price : activePosition.slPrice,
    );
    setMenu(null);
  };

  const placeQuickOrder = (side: Side, type: "limit" | "stop", price: number) => {
    if (!onPlaceOrder || price <= 0) return;
    onPlaceOrder(ticker, side, type, 250, 10, "isolated", price);
    setMenu(null);
  };

  const startProtectionDrag = (target: "tp" | "sl") => {
    if (!ENABLE_CHART_TPSL_DRAG) return;
    if (!activePosition) return;
    setDragTarget(target);
    setDragPreviewPrice(
      target === "tp"
        ? (effectiveTpPrice ?? activePosition.entryPrice)
        : (effectiveSlPrice ?? activePosition.entryPrice)
    );
  };

  return (
    <div
      ref={chartShellRef}
      className={`flex flex-col select-none ${isFullscreen ? "fixed inset-0 z-[100]" : "h-full min-h-0"}`}
      style={{ background: "linear-gradient(180deg, #060504 0%, #0a0908 100%)" }}
    >
      {/* ── Mobile: single compact header row ─────────────────────────────────── */}
      {isMobile ? (
        <div
          className="flex items-center gap-1 border-b shrink-0 px-1"
          style={{
            borderColor: "rgba(39,39,42,0.72)",
            background: "linear-gradient(180deg, rgba(27,22,16,0.98), rgba(12,11,10,0.96))",
            minHeight: 24,
          }}
        >
          {/* Ticker select + PERP */}
          <div className="flex items-center gap-0.5 shrink-0 border-r pr-1" style={{ borderColor: "rgba(39,39,42,0.72)" }}>
            <select
              className="cursor-pointer bg-transparent text-[9px] font-bold text-white outline-none"
              value={ticker}
              onChange={(event) => onTickerChange?.(event.target.value)}
            >
              {chartTickers.map((item) => (
                <option key={item} value={item} className="bg-[#0d0d14]">{item}</option>
              ))}
            </select>
            <span
              className="rounded px-0.5 py-px text-[6px] font-bold shrink-0"
              style={{ color: "#f0b90b", background: "rgba(240,185,11,0.1)", border: "1px solid rgba(240,185,11,0.2)" }}
            >
              PERP
            </span>
          </div>

          {/* Compact timeframe buttons */}
          <div className="flex items-center gap-px flex-1 justify-center">
            {(["5m", "1H", "4H", "1D", "1W"] as Timeframe[]).map((item) => (
              <button
                key={item}
                onClick={() => setTimeframe(item)}
                className="rounded px-1 py-px text-[9px] font-semibold transition-all"
                style={
                  timeframe === item
                    ? { color: "#f1d48f", background: "rgba(212,161,31,0.18)", border: "1px solid rgba(212,161,31,0.28)" }
                    : { color: "#52525b" }
                }
              >
                {item}
              </button>
            ))}
            {selectedEvent?.ticker?.includes(ticker) && (
              <button
                onClick={() => focusOnEvent(selectedEvent)}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium transition-all"
                style={
                  eventFocusArmed
                    ? {
                        color: "#f1d48f",
                        background: "linear-gradient(180deg, rgba(212,161,31,0.24), rgba(212,161,31,0.1))",
                        border: "1px solid rgba(212,161,31,0.28)",
                      }
                    : { color: "#6b7280" }
                }
                title="Focus chart around selected event"
              >
                Event
              </button>
            )}
          </div>

          {/* Chart type toggle + fullscreen */}
          <div className="flex items-center gap-px shrink-0">
            <button
              onClick={() => setChartType(chartType === "candles" ? "line" : "candles")}
              className="rounded px-1 py-px text-[8px] font-semibold transition-all"
              style={{ color: "#71717a", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              title={`Switch to ${chartType === "candles" ? "line" : "candles"}`}
            >
              {chartType === "candles" ? "C" : "L"}
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded p-0.5 transition-all"
              style={{ color: "#71717a", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-2.5 w-2.5" /> : <Maximize2 className="h-2.5 w-2.5" />}
            </button>
          </div>
        </div>
      ) : (
        /* ── Desktop: single compact header row ──────────────────────────────── */
        <div
          className="flex items-center gap-0 border-b px-3 shrink-0"
          style={{
            borderColor: "rgba(39,39,42,0.72)",
            background: "linear-gradient(180deg, rgba(27,22,16,0.97), rgba(12,11,10,0.95))",
            minHeight: 44,
          }}
        >
          {/* Ticker + PERP + position badge */}
          <div className="mr-3 flex items-center gap-2 border-r pr-3 shrink-0" style={{ borderColor: "rgba(39,39,42,0.72)" }}>
            <select
              className="cursor-pointer bg-transparent text-sm font-bold text-white outline-none"
              value={ticker}
              onChange={(event) => onTickerChange?.(event.target.value)}
            >
              {chartTickers.map((item) => (
                <option key={item} value={item} className="bg-[#0d0d14]">
                  {item}{quoteAsset}
                </option>
              ))}
            </select>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0"
              style={{
                color: "#f0b90b",
                background: "linear-gradient(180deg, rgba(240,185,11,0.18), rgba(240,185,11,0.08))",
                border: "1px solid rgba(240,185,11,0.28)",
              }}
            >
              PERP
            </span>
            {activePosition && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0"
                style={{
                  color: activePosition.side === "long" ? "#0ecb81" : "#f6465d",
                  background: activePosition.side === "long" ? "rgba(14,203,129,0.12)" : "rgba(246,70,93,0.12)",
                  border: `1px solid ${activePosition.side === "long" ? "rgba(14,203,129,0.28)" : "rgba(246,70,93,0.28)"}`,
                }}
              >
                {activePosition.side.toUpperCase()} {activePosition.leverage}x
              </span>
            )}
          </div>

          {/* Timeframe buttons */}
          <div className="flex items-center gap-0.5">
            {(["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"] as Timeframe[]).map((item) => (
              <button
                key={item}
                onClick={() => setTimeframe(item)}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium transition-all"
                style={
                  timeframe === item
                    ? {
                        color: "#f1d48f",
                        background: "linear-gradient(180deg, rgba(212,161,31,0.24), rgba(212,161,31,0.1))",
                        border: "1px solid rgba(212,161,31,0.28)",
                      }
                    : { color: "#6b7280" }
                }
              >
                {item}
              </button>
            ))}
          </div>

          {/* Chart type toggle */}
          <div className="ml-2 flex items-center gap-1 border-l pl-2" style={{ borderColor: "rgba(39,39,42,0.72)" }}>
            {(["candles", "line"] as ChartType[]).map((item) => (
              <button
                key={item}
                onClick={() => setChartType(item)}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition-all"
                style={
                  chartType === item
                    ? {
                        color: "#f5efe1",
                        background: "linear-gradient(180deg, rgba(43,35,22,0.94), rgba(26,22,17,0.94))",
                        border: "1px solid rgba(212,161,31,0.16)",
                      }
                    : { color: "#6b7280" }
                }
              >
                {item}
              </button>
            ))}
          </div>

          {/* Funding rate cards — pushed to right */}
          <div className="ml-auto flex items-center gap-2 border-l pl-3" style={{ borderColor: "rgba(39,39,42,0.72)" }}>
            {fundingRates.length > 0 ? (
              fundingRates.map((item) => {
                const positive = (item.rate ?? 0) >= 0;
                return (
                  <div
                    key={item.venue}
                    className="rounded-lg px-2 py-1"
                    style={{
                      minWidth: 86,
                      background: "linear-gradient(180deg, rgba(24,27,36,0.95), rgba(15,17,24,0.92))",
                      border: `1px solid ${
                        item.status === "live"
                          ? positive
                            ? "rgba(14,203,129,0.24)"
                            : "rgba(246,70,93,0.24)"
                          : "rgba(113,113,122,0.24)"
                      }`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: "#7c8292" }}>
                        {item.venue}
                      </span>
                      <span
                        className="text-[10px] font-bold tabular-nums"
                        style={{ color: item.status === "live" ? (positive ? "#0ecb81" : "#f6465d") : "#71717a" }}
                      >
                        {fmtFunding(item.rate)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[8px]" style={{ color: "#5f6473" }}>
                      {item.status === "live" ? `Next ${fmtFundingEta(item.nextFundingTime)}` : "Unavailable"}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className="rounded-lg px-2 py-1 text-[10px]"
                style={{
                  background: "linear-gradient(180deg, rgba(24,27,36,0.95), rgba(15,17,24,0.92))",
                  border: "1px solid rgba(113,113,122,0.22)",
                  color: "#71717a",
                }}
              >
                Funding…
              </div>
            )}
          </div>

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="ml-2 rounded-md p-1.5 transition-all shrink-0"
            style={{ color: "#71717a", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 bg-white/5">
        <div className="relative min-h-[200px] min-w-0 flex-1 bg-[#06080d] sm:min-h-[360px] xl:min-h-[520px]">

          {displayBar && (
            <div
              className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
              style={{
                background: "linear-gradient(180deg, rgba(18,21,30,0.92), rgba(10,12,18,0.9))",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 10,
                fontFamily: "monospace",
                boxShadow: "0 10px 22px rgba(0,0,0,0.25)",
              }}
            >
              <span style={{ color: "#52525b" }}>O</span>
              <span style={{ color: isUp ? "#0ecb81" : "#f6465d" }}>{fmtPrice(displayBar.open)}</span>
              <span style={{ color: "#52525b" }}>H</span>
              <span style={{ color: isUp ? "#0ecb81" : "#f6465d" }}>{fmtPrice(displayBar.high)}</span>
              <span style={{ color: "#52525b" }}>L</span>
              <span style={{ color: isUp ? "#0ecb81" : "#f6465d" }}>{fmtPrice(displayBar.low)}</span>
              <span style={{ color: "#52525b" }}>C</span>
              <span style={{ color: isUp ? "#0ecb81" : "#f6465d" }}>{fmtPrice(displayBar.close)}</span>
              <span style={{ color: "#52525b" }}>Vol</span>
              <span style={{ color: "#71717a" }}>{fmtVol(displayBar.volume)}</span>
            </div>
          )}

          {recentRelatedEvent && (
            <div
              className="pointer-events-auto absolute right-3 top-3 z-10 max-w-[52%] rounded-lg px-2.5 py-1.5"
              style={{
                background: "linear-gradient(180deg, rgba(18,21,30,0.92), rgba(10,12,18,0.9))",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 10px 22px rgba(0,0,0,0.25)",
              }}
            >
              <div className="truncate text-[10px] font-semibold text-zinc-100">
                {recentRelatedEvent.type === "whale" ? "Whale trigger" : "News trigger"}: {recentRelatedEvent.headline}
              </div>
              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => focusOnEvent(recentRelatedEvent)}
                  className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200 transition hover:bg-amber-500/20"
                >
                  Focus
                </button>
              </div>
            </div>
          )}

          {activePosition && (
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
              <span
                className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]"
                style={{
                  color: activePosition.side === "long" ? "#0ecb81" : "#f6465d",
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(10,12,18,0.82)",
                }}
              >
                {activePosition.side.toUpperCase()} {activePosition.leverage}x
              </span>
              {ENABLE_CHART_TPSL_DRAG && (
                <>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      startProtectionDrag("tp");
                    }}
                    className="pointer-events-auto rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]"
                    style={{
                      color: "#0ecb81",
                      borderColor: "rgba(14,203,129,0.24)",
                      background: "rgba(7,20,15,0.9)",
                    }}
                  >
                    {activePosition.tpPrice ? "Drag TP" : "Create TP"}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      startProtectionDrag("sl");
                    }}
                    className="pointer-events-auto rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]"
                    style={{
                      color: "#f6465d",
                      borderColor: "rgba(246,70,93,0.24)",
                      background: "rgba(22,10,13,0.9)",
                    }}
                  >
                    {activePosition.slPrice ? "Drag SL" : "Create SL"}
                  </button>
                </>
              )}
              {ENABLE_CHART_TPSL_DRAG && dragTarget && (
                <span
                  className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]"
                  style={{
                    color: dragTarget === "tp" ? "#0ecb81" : "#f6465d",
                    borderColor: "rgba(255,255,255,0.08)",
                    background: "rgba(10,12,18,0.82)",
                  }}
                >
                  Dragging {dragTarget.toUpperCase()}
                </span>
              )}
            </div>
          )}

          {chartReady && activePosition && (() => {
            const entryY = priceToCoordinate(activePosition.entryPrice);
            if (entryY === null) return null;
            const tp = effectiveTpPrice;
            const sl = effectiveSlPrice;
            const tpY = tp ? priceToCoordinate(tp) : null;
            const slY = sl ? priceToCoordinate(sl) : null;
            const rr =
              tp && sl
                ? Math.abs(tp - activePosition.entryPrice) / Math.max(Math.abs(sl - activePosition.entryPrice), 0.000001)
                : null;

            return (
              <>
                {tpY !== null && tp && (
                  <div
                    className="pointer-events-none absolute left-0 right-14 z-[4] flex items-center justify-end pr-3"
                    style={{
                      top: Math.max(tpY - 1, 0),
                      height: 0,
                      borderTop: "1px dashed rgba(14,203,129,0.75)",
                    }}
                  >
                    <span className="rounded-full bg-[#07140f]/90 px-2 py-1 text-[10px] text-emerald-300">
                      TP {fmtPrice(tp)}
                    </span>
                  </div>
                )}
                {slY !== null && sl && (
                  <div
                    className="pointer-events-none absolute left-0 right-14 z-[4] flex items-center justify-end pr-3"
                    style={{
                      top: Math.max(slY - 1, 0),
                      height: 0,
                      borderTop: "1px dashed rgba(246,70,93,0.75)",
                    }}
                  >
                    <span className="rounded-full bg-[#160a0d]/90 px-2 py-1 text-[10px] text-red-300">
                      SL {fmtPrice(sl)}
                    </span>
                  </div>
                )}
                {rr !== null && Number.isFinite(rr) && (
                  <div
                    className="pointer-events-none absolute z-[6]"
                    style={{ right: 16, top: entryY - 12 }}
                  >
                    <span className="rounded-full border border-white/8 bg-[#0b0f16]/92 px-2 py-1 text-[10px] text-zinc-200">
                      R/R {rr.toFixed(2)}
                    </span>
                  </div>
                )}
              </>
            );
          })()}

          <div
            ref={chartContainerRef}
            className="absolute inset-0 h-full w-full"
            onContextMenu={(event) => {
              event.preventDefault();
              const rect = chartContainerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const price = coordinateToPrice(event.clientY - rect.top);
              if (!price || price <= 0) return;
              setMenu({ x: event.clientX - rect.left, y: event.clientY - rect.top, price });
            }}
          />

          {shouldShowBlockingState && (
            <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
              <div className="pointer-events-auto rounded-2xl border border-white/8 bg-[#0b0f16]/92 px-5 py-4 text-center shadow-2xl backdrop-blur-xl">
                <div className="text-sm font-semibold text-zinc-100">
                  {chartError ? "Chart data unavailable" : isLoadingPrices ? "Loading chart..." : "No chart data"}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {chartError
                    ? "Check your connection or try refreshing."
                    : isLoadingPrices
                    ? `${ticker} ${TF_CONFIG[timeframe].label} candles are loading.`
                    : `No candles returned for ${ticker}.`}
                </div>
                {(chartError || (!isLoadingPrices && !hasChartData)) && (
                  <button
                    onClick={() => {
                      setChartError(null);
                      setIsLoadingPrices(true);
                      setRefreshNonce((prev) => prev + 1);
                    }}
                    className="mt-3 rounded-md border border-zinc-700/50 bg-zinc-800/60 px-3 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-700/60"
                  >
                    ⟳ Retry
                  </button>
                )}
              </div>
            </div>
          )}

          {menu && (
            <div
              className="absolute z-20 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f16]/96 shadow-2xl backdrop-blur-xl"
              style={{
                left: Math.min(menu.x + 12, (chartContainerRef.current?.clientWidth ?? 400) - 240),
                top: Math.min(menu.y + 12, (chartContainerRef.current?.clientHeight ?? 300) - 220),
                width: 220,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/8 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Chart Actions @ ${fmtPrice(menu.price)}
              </div>
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-emerald-300 transition hover:bg-white/[0.04]"
                onClick={() => applyQuickPositionUpdate("tp", menu.price)}
              >
                <span>Set Take Profit</span>
                <span className="text-zinc-500">${fmtPrice(menu.price)}</span>
              </button>
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-red-300 transition hover:bg-white/[0.04]"
                onClick={() => applyQuickPositionUpdate("sl", menu.price)}
              >
                <span>Set Stop Loss</span>
                <span className="text-zinc-500">${fmtPrice(menu.price)}</span>
              </button>
              {onPlaceOrder && (
                <>
                  <div className="h-px bg-white/8" />
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-amber-200 transition hover:bg-white/[0.04]"
                    onClick={() => placeQuickOrder("long", "limit", menu.price)}
                  >
                    <span>Place Limit Long</span>
                    <span className="text-zinc-500">${fmtPrice(menu.price)}</span>
                  </button>
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-[#f1dcc1] transition hover:bg-white/[0.04]"
                    onClick={() => placeQuickOrder("short", "limit", menu.price)}
                  >
                    <span>Place Limit Short</span>
                    <span className="text-zinc-500">${fmtPrice(menu.price)}</span>
                  </button>
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-amber-300 transition hover:bg-white/[0.04]"
                    onClick={() => placeQuickOrder("long", "stop", menu.price)}
                  >
                    <span>Place Stop Long</span>
                    <span className="text-zinc-500">${fmtPrice(menu.price)}</span>
                  </button>
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-rose-300 transition hover:bg-white/[0.04]"
                    onClick={() => placeQuickOrder("short", "stop", menu.price)}
                  >
                    <span>Place Stop Short</span>
                    <span className="text-zinc-500">${fmtPrice(menu.price)}</span>
                  </button>
                </>
              )}
              <div className="h-px bg-white/8" />
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-zinc-200 transition hover:bg-white/[0.04]"
                onClick={() => {
                  fitChart();
                  setMenu(null);
                }}
              >
                <span>Reset Chart View</span>
                <span className="text-zinc-500">Fit</span>
              </button>
              {activePosition?.tpPrice && (
                <button
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-zinc-200 transition hover:bg-white/[0.04]"
                  onClick={() => {
                    onUpdatePositionTpSl?.(activePosition.id, undefined, activePosition.slPrice);
                    setMenu(null);
                  }}
                >
                  <span>Clear Take Profit</span>
                  <span className="text-zinc-500">TP</span>
                </button>
              )}
              {activePosition?.slPrice && (
                <button
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] text-zinc-200 transition hover:bg-white/[0.04]"
                  onClick={() => {
                    onUpdatePositionTpSl?.(activePosition.id, activePosition.tpPrice, undefined);
                    setMenu(null);
                  }}
                >
                  <span>Clear Stop Loss</span>
                  <span className="text-zinc-500">SL</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
