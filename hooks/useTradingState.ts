"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type OrderType = "market" | "limit" | "stop";
export type Side = "long" | "short";
export type MarginMode = "isolated" | "cross";
export type OrderStatus = "filled" | "open" | "cancelled";

export type Position = {
  id: string;
  ticker: string;
  side: Side;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  margin: number;
  marginMode: MarginMode;
  liquidationPrice: number;
  tpPrice?: number;
  slPrice?: number;
  timestamp: Date;
};

export type Order = {
  id: string;
  ticker: string;
  side: Side;
  type: OrderType;
  status: OrderStatus;
  amount: number;
  price: number;
  total: number;
  margin: number;
  leverage: number;
  marginMode: MarginMode;
  fee: number;
  tpPrice?: number;
  slPrice?: number;
  timestamp: Date;
};

export type EquityPoint = { time: number; value: number };

const MOCK_PRICES: Record<string, number> = {
  BTC: 92153,
  ETH: 3165,
  SOL: 186,
  BNB: 572,
  XRP: 0.6,
  DOGE: 0.18,
  AVAX: 38,
  LINK: 18,
  ARB: 1.2,
  OP: 2.8,
  NEAR: 6.5,
  INJ: 28,
  DOT: 8.5,
  COIN: 185,
  MSTR: 320,
};

export function getBasePrice(ticker: string) {
  return MOCK_PRICES[ticker] ?? 100;
}

const MAINTENANCE_MARGIN_RATE = 0.005;
export const TAKER_FEE = 0.0005;
export const MAKER_FEE = 0.0002;

export function calcLiqPrice(side: Side, entryPrice: number, leverage: number): number {
  if (side === "long") {
    return entryPrice * (1 - 1 / leverage + MAINTENANCE_MARGIN_RATE);
  }

  return entryPrice * (1 + 1 / leverage - MAINTENANCE_MARGIN_RATE);
}

export function calcPnl(pos: Position): number {
  if (pos.side === "long") {
    return (pos.currentPrice - pos.entryPrice) * pos.amount;
  }

  return (pos.entryPrice - pos.currentPrice) * pos.amount;
}

export function calcRoe(pos: Position): number {
  return (calcPnl(pos) / pos.margin) * 100;
}

function shouldTriggerOrder(order: Order, currentPrice: number) {
  if (order.type === "limit") {
    return order.side === "long" ? currentPrice <= order.price : currentPrice >= order.price;
  }

  if (order.type === "stop") {
    return order.side === "long" ? currentPrice >= order.price : currentPrice <= order.price;
  }

  return false;
}

export function useTradingState(livePrices?: Record<string, number>) {
  const [balance, setBalance] = useState(10000);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({ ...MOCK_PRICES });
  const [equityHistory, setEquityHistory] = useState<EquityPoint[]>([
    { time: Date.now(), value: 10000 },
  ]);

  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  useEffect(() => {
    if (!livePrices || Object.keys(livePrices).length === 0) return;

    setPrices((prev) => {
      const hasChange = Object.entries(livePrices).some(([ticker, price]) => prev[ticker] !== price);
      return hasChange ? { ...prev, ...livePrices } : prev;
    });
  }, [livePrices]);

  useEffect(() => {
    setPositions((prev) => {
      let balanceDelta = 0;

      const next = prev
        .map((position) => ({
          ...position,
          currentPrice: prices[position.ticker] ?? position.currentPrice,
        }))
        .filter((position) => {
          if (position.side === "long" && position.currentPrice <= position.liquidationPrice) {
            return false;
          }
          if (position.side === "short" && position.currentPrice >= position.liquidationPrice) {
            return false;
          }

          if (position.tpPrice !== undefined) {
            const hitTp =
              (position.side === "long" && position.currentPrice >= position.tpPrice) ||
              (position.side === "short" && position.currentPrice <= position.tpPrice);

            if (hitTp) {
              const closePrice = position.tpPrice;
              const pnl =
                position.side === "long"
                  ? (closePrice - position.entryPrice) * position.amount
                  : (position.entryPrice - closePrice) * position.amount;
              const fee = position.amount * closePrice * TAKER_FEE;
              balanceDelta += Math.max(position.margin + pnl - fee, 0);
              return false;
            }
          }

          if (position.slPrice !== undefined) {
            const hitSl =
              (position.side === "long" && position.currentPrice <= position.slPrice) ||
              (position.side === "short" && position.currentPrice >= position.slPrice);

            if (hitSl) {
              const closePrice = position.slPrice;
              const pnl =
                position.side === "long"
                  ? (closePrice - position.entryPrice) * position.amount
                  : (position.entryPrice - closePrice) * position.amount;
              const fee = position.amount * closePrice * TAKER_FEE;
              balanceDelta += Math.max(position.margin + pnl - fee, 0);
              return false;
            }
          }

          return true;
        });

      if (balanceDelta > 0) {
        balanceRef.current += balanceDelta;
        setBalance((prevBalance) => prevBalance + balanceDelta);
      }

      return next;
    });
  }, [prices]);

  const equityRef = useRef({ balance, positions });
  equityRef.current = { balance, positions };

  useEffect(() => {
    const id = setInterval(() => {
      const { balance: currentBalance, positions: currentPositions } = equityRef.current;
      const equity =
        currentBalance +
        currentPositions.reduce((sum, position) => sum + calcPnl(position) + position.margin, 0);

      setEquityHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.abs(last.value - equity) < 0.01) return prev;
        return [...prev.slice(-200), { time: Date.now(), value: equity }];
      });
    }, 10_000);

    return () => clearInterval(id);
  }, []);

  const applyFilledOrder = useCallback((order: Order, execPrice: number) => {
    const feeRate = order.type === "market" || order.type === "stop" ? TAKER_FEE : MAKER_FEE;
    const fee = order.margin * order.leverage * feeRate;
    const totalCost = order.margin + fee;

    if (totalCost > balanceRef.current) return false;

    balanceRef.current -= totalCost;
    setBalance((prev) => prev - totalCost);

    setPositions((prev) => {
      const opposing = prev.find((position) => position.ticker === order.ticker && position.side !== order.side);

      if (opposing) {
        const closePnl = calcPnl({ ...opposing, currentPrice: execPrice });
        const closeReturn = opposing.margin + closePnl - opposing.amount * execPrice * TAKER_FEE;
        const realizedReturn = Math.max(closeReturn, 0);
        balanceRef.current += realizedReturn;
        setBalance((prevBalance) => prevBalance + realizedReturn);
        return prev.filter((position) => position.id !== opposing.id);
      }

      const existing = prev.find((position) => position.ticker === order.ticker && position.side === order.side);

      if (existing) {
        const newAmount = existing.amount + order.amount;
        const newEntryPrice =
          (existing.entryPrice * existing.amount + execPrice * order.amount) / newAmount;
        const newMargin = existing.margin + order.margin;
        const nextLeverage = order.leverage;

        return prev.map((position) =>
          position.id === existing.id
            ? {
                ...position,
                amount: newAmount,
                entryPrice: newEntryPrice,
                margin: newMargin,
                leverage: nextLeverage,
                marginMode: order.marginMode,
                currentPrice: execPrice,
                liquidationPrice: calcLiqPrice(order.side, newEntryPrice, nextLeverage),
                tpPrice: order.tpPrice ?? position.tpPrice,
                slPrice: order.slPrice ?? position.slPrice,
              }
            : position
        );
      }

      return [
        ...prev,
        {
          id: Date.now().toString(),
          ticker: order.ticker,
          side: order.side,
          amount: order.amount,
          entryPrice: execPrice,
          currentPrice: execPrice,
          leverage: order.leverage,
          margin: order.margin,
          marginMode: order.marginMode,
          liquidationPrice: calcLiqPrice(order.side, execPrice, order.leverage),
          tpPrice: order.tpPrice,
          slPrice: order.slPrice,
          timestamp: new Date(),
        },
      ];
    });

    return true;
  }, []);

  useEffect(() => {
    const triggerableOrders = orders.filter((order) => {
      if (order.status !== "open") return false;
      const currentPrice = prices[order.ticker];
      if (!currentPrice) return false;
      return shouldTriggerOrder(order, currentPrice);
    });

    if (triggerableOrders.length === 0) return;

    triggerableOrders.forEach((order) => {
      const currentPrice = prices[order.ticker] ?? order.price;
      const execPrice = order.type === "stop" ? currentPrice : order.price;
      const feeRate = order.type === "stop" ? TAKER_FEE : MAKER_FEE;
      const fee = order.total * feeRate;
      const filledOrder: Order = {
        ...order,
        status: "filled",
        fee,
      };

      if (!applyFilledOrder(filledOrder, execPrice)) return;

      setOrders((prev) =>
        prev.map((existing) =>
          existing.id === order.id ? { ...filledOrder, price: execPrice } : existing
        )
      );
    });
  }, [applyFilledOrder, orders, prices]);

  const placeOrder = useCallback(
    (
      ticker: string,
      side: Side,
      type: OrderType,
      marginAmount: number,
      leverage: number,
      marginMode: MarginMode,
      limitPrice?: number,
      tpPrice?: number,
      slPrice?: number,
    ) => {
      const triggerPrice =
        (type === "limit" || type === "stop") && limitPrice
          ? limitPrice
          : prices[ticker] ?? getBasePrice(ticker);
      const execPrice = type === "market" ? prices[ticker] ?? getBasePrice(ticker) : triggerPrice;
      const feeRate = type === "market" || type === "stop" ? TAKER_FEE : MAKER_FEE;
      const notional = marginAmount * leverage;
      const contractAmount = notional / execPrice;
      const fee = notional * feeRate;
      const totalCost = marginAmount + fee;

      if (type === "market" && totalCost > balanceRef.current) return false;

      const order: Order = {
        id: Date.now().toString(),
        ticker,
        side,
        type,
        status: type === "market" ? "filled" : "open",
        amount: contractAmount,
        price: triggerPrice,
        total: notional,
        margin: marginAmount,
        leverage,
        marginMode,
        fee,
        tpPrice: tpPrice && tpPrice > 0 ? tpPrice : undefined,
        slPrice: slPrice && slPrice > 0 ? slPrice : undefined,
        timestamp: new Date(),
      };

      setOrders((prev) => [order, ...prev.slice(0, 49)]);

      if (type === "market") {
        applyFilledOrder({ ...order, status: "filled" }, execPrice);
      }

      return true;
    },
    [applyFilledOrder, prices]
  );

  const closePosition = useCallback((posId: string, closePercent = 100) => {
    setPositions((prev) => {
      const position = prev.find((item) => item.id === posId);
      if (!position) return prev;
      const ratio = Math.max(1, Math.min(100, Number(closePercent) || 100)) / 100;
      const closeAmount = position.amount * ratio;
      if (!Number.isFinite(closeAmount) || closeAmount <= 0) return prev;

      const pnl = calcPnl(position) * ratio;
      const fee = closeAmount * position.currentPrice * TAKER_FEE;
      const closeMargin = position.margin * ratio;
      const returns = closeMargin + pnl - fee;
      const realizedReturn = Math.max(returns, 0);

      balanceRef.current += realizedReturn;
      setBalance((prevBalance) => prevBalance + realizedReturn);

      setOrders((currentOrders) => [
        {
          id: Date.now().toString(),
          ticker: position.ticker,
          side: position.side === "long" ? "short" : "long",
          type: "market",
          status: "filled",
          amount: closeAmount,
          price: position.currentPrice,
          total: closeAmount * position.currentPrice,
          margin: closeMargin,
          leverage: position.leverage,
          marginMode: position.marginMode,
          fee,
          tpPrice: undefined,
          slPrice: undefined,
          timestamp: new Date(),
        },
        ...currentOrders.slice(0, 49),
      ]);

      if (ratio >= 0.999) {
        return prev.filter((item) => item.id !== posId);
      }
      return prev.map((item) =>
        item.id === posId
          ? {
              ...item,
              amount: Math.max(0, item.amount - closeAmount),
              margin: Math.max(0, item.margin - closeMargin),
            }
          : item,
      );
    });
  }, []);

  const cancelOrder = useCallback((orderId: string) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, status: "cancelled" as OrderStatus } : order))
    );
  }, []);

  const updatePositionTpSl = useCallback(
    (posId: string, tpPrice: number | undefined, slPrice: number | undefined) => {
      setPositions((prev) =>
        prev.map((position) =>
          position.id === posId
            ? { ...position, tpPrice: tpPrice ?? undefined, slPrice: slPrice ?? undefined }
            : position
        )
      );
    },
    []
  );

  return {
    balance,
    positions,
    orders,
    prices,
    equityHistory,
    placeOrder,
    closePosition,
    cancelOrder,
    updatePositionTpSl,
  };
}
