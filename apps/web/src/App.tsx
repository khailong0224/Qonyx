import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
  CircleDollarSign,
  Command,
  Gauge,
  Layers3,
  LineChart,
  LockKeyhole,
  Menu,
  Pause,
  Play,
  PlugZap,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type View = "dashboard" | "strategy" | "bots" | "research" | "risk" | "exchange";
type BadgeVariant = "active" | "paused" | "risk" | "paper" | "ai" | "neutral";
type ChartWindow = "1D" | "1W" | "1M";
type MarketProduct =
  | "BTC-USD"
  | "ETH-USD"
  | "SOL-USD"
  | "XRP-USD"
  | "DOGE-USD"
  | "ADA-USD"
  | "AVAX-USD"
  | "LINK-USD";
type SignalType =
  | "VWAP Reclaim"
  | "Momentum Breakout"
  | "Mean Reversion"
  | "Dynamic Grid"
  | "RSI Bollinger Reversion"
  | "MACD Trend Pullback"
  | "Funding Carry"
  | "Pairs Stat Arb"
  | "DCA Rebalance"
  | "Market Making Spread"
  | "Liquidity Breakout";
type RiskProfile = "Conservative" | "Balanced" | "Aggressive";
type BacktestStatus = "idle" | "running" | "ready" | "error";
type BotStatus = "Active" | "Paused" | "Paper";
type StrategyPresetId =
  | "adaptive-trend"
  | "dynamic-grid"
  | "vwap-reclaim"
  | "rsi-bollinger"
  | "macd-pullback"
  | "funding-carry"
  | "pairs-stat-arb"
  | "dca-rebalance"
  | "market-maker"
  | "liquidity-breakout";

type MarketCandle = {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
};

type TickerResponse = {
  price?: string;
  time?: string;
};

type ChartPoint = {
  candle: MarketCandle;
  x: number;
  openY: number;
  highY: number;
  lowY: number;
  closeY: number;
};

type StrategyConfig = {
  market: MarketProduct;
  signal: SignalType;
  strategyId: StrategyPresetId;
  riskProfile: RiskProfile;
};

type BacktestTrade = {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  returnPct: number;
  reason: string;
};

type BacktestResult = {
  finalEquity: number;
  initialCapital: number;
  maxDrawdown: number;
  netPnl: number;
  netReturn: number;
  product: MarketProduct;
  signal: SignalType;
  timeRange: string;
  trades: BacktestTrade[];
  winRate: number;
};

type AiBrief = {
  title: string;
  summary: string;
  bullets: string[];
  confidence: string;
};

type StrategyPreset = {
  id: StrategyPresetId;
  name: string;
  signal: SignalType;
  market: MarketProduct;
  riskProfile: RiskProfile;
  allocation: number;
  category: string;
  fit: string;
  regime: string;
  note: string;
};

type TradingBot = {
  id: string;
  allocation: number;
  lastAction: string;
  market: MarketProduct;
  name: string;
  platform: string;
  pnl: number;
  pnlPct: number;
  runtimeHours: number;
  status: BotStatus;
  strategyId: StrategyPresetId;
};

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Command", icon: BarChart3 },
  { id: "strategy", label: "Strategy Lab", icon: Layers3 },
  { id: "bots", label: "Bots", icon: Bot },
  { id: "research", label: "AI Research", icon: BrainCircuit },
  { id: "risk", label: "Risk Center", icon: ShieldAlert },
  { id: "exchange", label: "Exchanges", icon: PlugZap },
];

const metrics = [
  {
    label: "Portfolio Value",
    value: "$284,912",
    trend: "+4.2%",
    tone: "profit",
    icon: Wallet,
  },
  {
    label: "Daily PnL",
    value: "+$8,431",
    trend: "+2.9%",
    tone: "profit",
    icon: TrendingUp,
  },
  {
    label: "Active Strategies",
    value: "12",
    trend: "8 live",
    tone: "info",
    icon: Activity,
  },
  {
    label: "Max Drawdown",
    value: "3.8%",
    trend: "-0.6%",
    tone: "warning",
    icon: TrendingDown,
  },
];

const strategyPresets: StrategyPreset[] = [
  {
    allocation: 10000,
    category: "Trend",
    fit: "High",
    id: "adaptive-trend",
    market: "BTC-USD",
    name: "Adaptive Trend Rider",
    note: "Follows confirmed directional moves and cuts exposure when the slow trend breaks.",
    regime: "Strong directional markets",
    riskProfile: "Balanced",
    signal: "Momentum Breakout",
  },
  {
    allocation: 7500,
    category: "Grid",
    fit: "High",
    id: "dynamic-grid",
    market: "ETH-USD",
    name: "Dynamic Grid Range",
    note: "Builds around range volatility and avoids chasing when price expands too fast.",
    regime: "Sideways volatile markets",
    riskProfile: "Conservative",
    signal: "Dynamic Grid",
  },
  {
    allocation: 6000,
    category: "Intraday",
    fit: "Medium",
    id: "vwap-reclaim",
    market: "BTC-USD",
    name: "VWAP Reclaim Scalp",
    note: "Looks for price reclaiming volume-weighted fair value after a flush.",
    regime: "Liquid intraday reversals",
    riskProfile: "Conservative",
    signal: "VWAP Reclaim",
  },
  {
    allocation: 6500,
    category: "Mean reversion",
    fit: "Medium",
    id: "rsi-bollinger",
    market: "SOL-USD",
    name: "RSI Bollinger Reversion",
    note: "Buys stretched pullbacks only after sellers show exhaustion.",
    regime: "Choppy mean-reverting markets",
    riskProfile: "Balanced",
    signal: "RSI Bollinger Reversion",
  },
  {
    allocation: 8000,
    category: "Trend",
    fit: "Medium",
    id: "macd-pullback",
    market: "ETH-USD",
    name: "MACD Trend Pullback",
    note: "Uses fast/slow average recovery as a simple MACD-style continuation filter.",
    regime: "Trending markets with pullbacks",
    riskProfile: "Balanced",
    signal: "MACD Trend Pullback",
  },
  {
    allocation: 12000,
    category: "Carry",
    fit: "Specialist",
    id: "funding-carry",
    market: "BTC-USD",
    name: "Funding Carry Monitor",
    note: "Keeps spot-style trend confirmation around a market-neutral funding idea.",
    regime: "Positive funding/carry windows",
    riskProfile: "Conservative",
    signal: "Funding Carry",
  },
  {
    allocation: 7000,
    category: "Stat arb",
    fit: "Specialist",
    id: "pairs-stat-arb",
    market: "ETH-USD",
    name: "Pairs Stat Arb",
    note: "Treats sharp deviations from slow fair value as pair-style reversion candidates.",
    regime: "Correlated majors diverging",
    riskProfile: "Balanced",
    signal: "Pairs Stat Arb",
  },
  {
    allocation: 5000,
    category: "Accumulation",
    fit: "High",
    id: "dca-rebalance",
    market: "BTC-USD",
    name: "DCA Rebalance",
    note: "Adds smaller entries during weakness and exits only after a recovery threshold.",
    regime: "Long-term accumulation",
    riskProfile: "Conservative",
    signal: "DCA Rebalance",
  },
  {
    allocation: 9000,
    category: "Market making",
    fit: "Specialist",
    id: "market-maker",
    market: "ETH-USD",
    name: "Market Making Spread",
    note: "Simulates buying lower-half range dips and flattening near fair value.",
    regime: "High-liquidity tight spreads",
    riskProfile: "Conservative",
    signal: "Market Making Spread",
  },
  {
    allocation: 6500,
    category: "Breakout",
    fit: "Medium",
    id: "liquidity-breakout",
    market: "SOL-USD",
    name: "Liquidity Breakout",
    note: "Requires a range break plus volume confirmation to avoid weak breakouts.",
    regime: "Expansion after compression",
    riskProfile: "Aggressive",
    signal: "Liquidity Breakout",
  },
];

const presetById = Object.fromEntries(strategyPresets.map((preset) => [preset.id, preset])) as Record<
  StrategyPresetId,
  StrategyPreset
>;

const initialBots: TradingBot[] = [
  {
    allocation: 12500,
    id: "bot-onyx-trend",
    lastAction: "12m ago",
    market: "BTC-USD",
    name: "Onyx Trend Alpha",
    platform: "Coinbase Paper",
    pnl: 842,
    pnlPct: 0.0674,
    runtimeHours: 74,
    status: "Active",
    strategyId: "adaptive-trend",
  },
  {
    allocation: 9000,
    id: "bot-eth-grid",
    lastAction: "34m ago",
    market: "ETH-USD",
    name: "ETH Dynamic Grid",
    platform: "Qonyx Paper",
    pnl: 318,
    pnlPct: 0.0353,
    runtimeHours: 41,
    status: "Paper",
    strategyId: "dynamic-grid",
  },
  {
    allocation: 6000,
    id: "bot-sol-reversion",
    lastAction: "1h ago",
    market: "SOL-USD",
    name: "SOL Reversion Guard",
    platform: "Qonyx Paper",
    pnl: -96,
    pnlPct: -0.016,
    runtimeHours: 18,
    status: "Paused",
    strategyId: "rsi-bollinger",
  },
];

const strategies = [
  {
    name: "Onyx Momentum",
    market: "BTC/USDT",
    pnl: "+$3,214",
    winRate: "68%",
    status: "Active",
    risk: "Low",
  },
  {
    name: "Mean Revert Alpha",
    market: "ETH/USDT",
    pnl: "+$1,904",
    winRate: "61%",
    status: "Paper",
    risk: "Medium",
  },
  {
    name: "Volatility Guard",
    market: "SOL/USDT",
    pnl: "-$284",
    winRate: "54%",
    status: "Paused",
    risk: "Guarded",
  },
];

const insightCards = [
  {
    title: "Liquidity Sweep Detected",
    body: "BTC order flow shows a shallow sell-side sweep with recovery above VWAP.",
    confidence: "87%",
    variant: "ai" as const,
  },
  {
    title: "Risk Compression",
    body: "Portfolio exposure is clustered in high-beta pairs. Suggested cap: 22%.",
    confidence: "74%",
    variant: "risk" as const,
  },
];

const marketWindowConfig: Record<ChartWindow, { durationMs: number; granularity: number; label: string }> = {
  "1D": { durationMs: 24 * 60 * 60 * 1000, granularity: 3600, label: "Hourly candles" },
  "1W": { durationMs: 7 * 24 * 60 * 60 * 1000, granularity: 21600, label: "6 hour candles" },
  "1M": { durationMs: 30 * 24 * 60 * 60 * 1000, granularity: 86400, label: "Daily candles" },
};

const strategyOptions = {
  markets: ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD", "ADA-USD", "AVAX-USD", "LINK-USD"] as MarketProduct[],
  riskProfiles: ["Conservative", "Balanced", "Aggressive"] as RiskProfile[],
  signals: [
    "Momentum Breakout",
    "Dynamic Grid",
    "VWAP Reclaim",
    "RSI Bollinger Reversion",
    "MACD Trend Pullback",
    "Funding Carry",
    "Pairs Stat Arb",
    "DCA Rebalance",
    "Market Making Spread",
    "Liquidity Breakout",
    "Mean Reversion",
  ] as SignalType[],
};

const riskProfileConfig: Record<RiskProfile, { maxPosition: number; stopLoss: number; takeProfit: number }> = {
  Aggressive: { maxPosition: 0.28, stopLoss: 0.055, takeProfit: 0.095 },
  Balanced: { maxPosition: 0.2, stopLoss: 0.038, takeProfit: 0.066 },
  Conservative: { maxPosition: 0.12, stopLoss: 0.024, takeProfit: 0.042 },
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  style: "currency",
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  signDisplay: "always",
  style: "percent",
});

const plainPercentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  style: "percent",
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

function productToDisplay(product: MarketProduct) {
  return product.replace("-", "/");
}

function formatRuntime(hours: number) {
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function botStatusVariant(status: BotStatus): BadgeVariant {
  if (status === "Active") {
    return "active";
  }

  if (status === "Paper") {
    return "paper";
  }

  return "paused";
}

async function fetchCoinbaseCandles({
  durationMs,
  granularity,
  product,
  signal,
}: {
  durationMs: number;
  granularity: number;
  product: MarketProduct;
  signal?: AbortSignal;
}) {
  const end = new Date();
  const start = new Date(end.getTime() - durationMs);
  const candleUrl = new URL(`https://api.exchange.coinbase.com/products/${product}/candles`);
  candleUrl.searchParams.set("granularity", String(granularity));
  candleUrl.searchParams.set("start", start.toISOString());
  candleUrl.searchParams.set("end", end.toISOString());

  const response = await fetch(candleUrl, { signal });

  if (!response.ok) {
    throw new Error(`${product} candles are temporarily unavailable.`);
  }

  const candlePayload = await response.json();
  const parsedCandles = parseCoinbaseCandles(candlePayload);

  if (parsedCandles.length === 0) {
    throw new Error(`Coinbase returned no ${product} candles for this range.`);
  }

  return parsedCandles;
}

async function fetchCoinbaseTicker(product: MarketProduct, signal?: AbortSignal) {
  const response = await fetch(`https://api.exchange.coinbase.com/products/${product}/ticker`, { signal });

  if (!response.ok) {
    throw new Error(`${product} ticker is temporarily unavailable.`);
  }

  return (await response.json()) as TickerResponse;
}

function parseCoinbaseCandles(payload: unknown): MarketCandle[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((item): item is [number, number, number, number, number, number] => {
      return (
        Array.isArray(item) &&
        item.length >= 6 &&
        item.every((value) => typeof value === "number" && Number.isFinite(value))
      );
    })
    .map(([time, low, high, open, close, volume]) => ({
      close,
      high,
      low,
      open,
      time,
      volume,
    }))
    .sort((a, b) => a.time - b.time);
}

function getChartPoints(candles: MarketCandle[]): ChartPoint[] {
  if (candles.length === 0) {
    return [];
  }

  const minPrice = Math.min(...candles.map((candle) => candle.low));
  const maxPrice = Math.max(...candles.map((candle) => candle.high));
  const range = maxPrice - minPrice || 1;
  const top = 8;
  const bottom = 72;
  const height = bottom - top;
  const priceToY = (price: number) => bottom - ((price - minPrice) / range) * height;

  return candles.map((candle, index) => {
    const x = candles.length === 1 ? 50 : (index / (candles.length - 1)) * 100;
    return {
      candle,
      closeY: priceToY(candle.close),
      highY: priceToY(candle.high),
      lowY: priceToY(candle.low),
      openY: priceToY(candle.open),
      x,
    };
  });
}

function formatChartTime(time: number, window: ChartWindow) {
  return new Intl.DateTimeFormat("en-US", {
    day: window === "1D" ? undefined : "numeric",
    hour: window === "1M" ? undefined : "numeric",
    minute: window === "1D" ? "2-digit" : undefined,
    month: window === "1D" ? undefined : "short",
  }).format(new Date(time * 1000));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rollingVwap(candles: MarketCandle[], endIndex: number, length: number) {
  const start = Math.max(0, endIndex - length + 1);
  const slice = candles.slice(start, endIndex + 1);
  const volume = slice.reduce((sum, candle) => sum + candle.volume, 0);

  if (volume === 0) {
    return slice[slice.length - 1]?.close ?? 0;
  }

  return slice.reduce((sum, candle) => {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    return sum + typicalPrice * candle.volume;
  }, 0) / volume;
}

function recentVolatility(candles: MarketCandle[], endIndex: number, length: number) {
  const start = Math.max(1, endIndex - length + 1);
  const returns = candles.slice(start, endIndex + 1).map((candle, index, slice) => {
    const previous = index === 0 ? candles[start - 1] : slice[index - 1];
    return previous ? Math.abs((candle.close - previous.close) / previous.close) : 0;
  });

  return average(returns);
}

function relativeStrengthIndex(candles: MarketCandle[], endIndex: number, length: number) {
  if (endIndex < length) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let index = endIndex - length + 1; index <= endIndex; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    const move = current.close - previous.close;

    if (move >= 0) {
      gains += move;
    } else {
      losses += Math.abs(move);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function shouldEnterTrade(candles: MarketCandle[], index: number, signal: SignalType) {
  const candle = candles[index];
  const previous = candles[index - 1];

  if (!candle || !previous || index < 12) {
    return false;
  }

  const recentCloses = candles.slice(index - 8, index).map((item) => item.close);
  const slowCloses = candles.slice(index - 12, index).map((item) => item.close);
  const fastAverage = average(recentCloses.slice(-4));
  const slowAverage = average(slowCloses);
  const currentVwap = rollingVwap(candles, index, 8);
  const previousVwap = rollingVwap(candles, index - 1, 8);
  const priorHigh = Math.max(...candles.slice(index - 8, index).map((item) => item.high));
  const recentLows = candles.slice(index - 8, index).map((item) => item.low);
  const priorLow = Math.min(...recentLows);
  const recentRange = (priorHigh - priorLow) / slowAverage;
  const recentVolume = average(candles.slice(index - 8, index).map((item) => item.volume));
  const currentRsi = relativeStrengthIndex(candles, index, 10);
  const volatility = recentVolatility(candles, index, 10);

  if (signal === "VWAP Reclaim") {
    return previous.close <= previousVwap && candle.close > currentVwap && fastAverage >= slowAverage;
  }

  if (signal === "Momentum Breakout") {
    return candle.close > priorHigh && fastAverage > slowAverage;
  }

  if (signal === "Dynamic Grid") {
    const rangeMidpoint = (priorHigh + priorLow) / 2;
    return recentRange > 0.025 && candle.close < rangeMidpoint && candle.close > priorLow * 1.006;
  }

  if (signal === "RSI Bollinger Reversion") {
    const stretch = candle.close < slowAverage * 0.975;
    return currentRsi < 38 && stretch && candle.close > candle.open;
  }

  if (signal === "MACD Trend Pullback") {
    return fastAverage > slowAverage && previous.close < fastAverage && candle.close > fastAverage;
  }

  if (signal === "Funding Carry") {
    return fastAverage >= slowAverage && volatility < 0.022 && candle.close > currentVwap;
  }

  if (signal === "Pairs Stat Arb") {
    return candle.close < slowAverage * 0.985 && currentRsi < 45;
  }

  if (signal === "DCA Rebalance") {
    return index % 8 === 0 && candle.close < slowAverage * 1.01;
  }

  if (signal === "Market Making Spread") {
    const rangeMidpoint = (priorHigh + priorLow) / 2;
    return volatility < 0.03 && candle.close < rangeMidpoint * 0.995 && candle.close > priorLow;
  }

  if (signal === "Liquidity Breakout") {
    return candle.close > priorHigh && candle.volume > recentVolume * 1.2 && fastAverage > slowAverage;
  }

  return candle.close < slowAverage * 0.982 && candle.close > candle.open;
}

function shouldExitTrade(
  candles: MarketCandle[],
  index: number,
  signal: SignalType,
  entryPrice: number,
  riskProfile: RiskProfile,
  entryIndex: number,
) {
  const candle = candles[index];
  const config = riskProfileConfig[riskProfile];
  const stopPrice = entryPrice * (1 - config.stopLoss);
  const takeProfitPrice = entryPrice * (1 + config.takeProfit);

  if (candle.low <= stopPrice) {
    return { price: stopPrice, reason: "Stop loss" };
  }

  if (candle.high >= takeProfitPrice) {
    return { price: takeProfitPrice, reason: "Take profit" };
  }

  const slowAverage = average(candles.slice(Math.max(0, index - 10), index + 1).map((item) => item.close));
  const currentVwap = rollingVwap(candles, index, 8);
  const holdBars = index - entryIndex;

  if (signal === "VWAP Reclaim" && candle.close < currentVwap) {
    return { price: candle.close, reason: "VWAP lost" };
  }

  if (signal === "Momentum Breakout" && candle.close < slowAverage) {
    return { price: candle.close, reason: "Momentum faded" };
  }

  if (signal === "Mean Reversion" && candle.close >= slowAverage) {
    return { price: candle.close, reason: "Mean reached" };
  }

  if (signal === "Dynamic Grid" && candle.close >= slowAverage) {
    return { price: candle.close, reason: "Grid midpoint" };
  }

  if (signal === "RSI Bollinger Reversion" && (candle.close >= slowAverage || holdBars >= 8)) {
    return { price: candle.close, reason: "Reversion reached" };
  }

  if (signal === "MACD Trend Pullback" && candle.close < slowAverage) {
    return { price: candle.close, reason: "Trend failed" };
  }

  if (signal === "Funding Carry" && (candle.close < currentVwap || holdBars >= 10)) {
    return { price: candle.close, reason: "Carry window closed" };
  }

  if (signal === "Pairs Stat Arb" && candle.close >= slowAverage) {
    return { price: candle.close, reason: "Spread normalized" };
  }

  if (signal === "DCA Rebalance" && holdBars >= 6 && candle.close > entryPrice * 1.012) {
    return { price: candle.close, reason: "Rebalance profit" };
  }

  if (signal === "Market Making Spread" && (candle.close >= slowAverage || holdBars >= 5)) {
    return { price: candle.close, reason: "Spread captured" };
  }

  if (signal === "Liquidity Breakout" && candle.close < slowAverage) {
    return { price: candle.close, reason: "Breakout failed" };
  }

  return null;
}

function runBacktest(candles: MarketCandle[], strategy: StrategyConfig, initialCapital: number): BacktestResult {
  const config = riskProfileConfig[strategy.riskProfile];
  const trades: BacktestTrade[] = [];
  const equityCurve = [initialCapital];
  let equity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let openTrade: { entryIndex: number; entryPrice: number; entryTime: number; size: number } | null = null;

  for (let index = 12; index < candles.length; index += 1) {
    const candle = candles[index];

    if (!openTrade && shouldEnterTrade(candles, index, strategy.signal)) {
      openTrade = {
        entryIndex: index,
        entryPrice: candle.close,
        entryTime: candle.time,
        size: equity * config.maxPosition,
      };
      continue;
    }

    if (openTrade) {
      const exit = shouldExitTrade(
        candles,
        index,
        strategy.signal,
        openTrade.entryPrice,
        strategy.riskProfile,
        openTrade.entryIndex,
      );
      const isLastCandle = index === candles.length - 1;

      if (exit || isLastCandle) {
        const exitPrice = exit?.price ?? candle.close;
        const returnPct = (exitPrice - openTrade.entryPrice) / openTrade.entryPrice;
        const pnl = openTrade.size * returnPct;
        equity += pnl;
        peakEquity = Math.max(peakEquity, equity);
        maxDrawdown = Math.max(maxDrawdown, (peakEquity - equity) / peakEquity);
        equityCurve.push(equity);
        trades.push({
          entryPrice: openTrade.entryPrice,
          entryTime: openTrade.entryTime,
          exitPrice,
          exitTime: candle.time,
          pnl,
          reason: exit?.reason ?? "Range end",
          returnPct,
        });
        openTrade = null;
      }
    }
  }

  const wins = trades.filter((trade) => trade.pnl > 0).length;
  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];
  const timeRange = `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(firstCandle.time * 1000))} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(lastCandle.time * 1000))}`;

  return {
    finalEquity: equity,
    initialCapital,
    maxDrawdown,
    netPnl: equity - initialCapital,
    netReturn: (equity - initialCapital) / initialCapital,
    product: strategy.market,
    signal: strategy.signal,
    timeRange,
    trades,
    winRate: trades.length > 0 ? wins / trades.length : 0,
  };
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [paperMode, setPaperMode] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [tradingLocked, setTradingLocked] = useState(false);
  const [paperCapital, setPaperCapital] = useState(10000);
  const [connectedExchange, setConnectedExchange] = useState(false);
  const [bots, setBots] = useState<TradingBot[]>(initialBots);

  const activeTitle = useMemo(
    () => navItems.find((item) => item.id === activeView)?.label ?? "Command",
    [activeView],
  );

  const handleSearchSubmit = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return;
    }

    const matchedNav = navItems.find((item) => {
      return item.label.toLowerCase().includes(normalizedQuery) || item.id.includes(normalizedQuery);
    });

    if (matchedNav) {
      setActiveView(matchedNav.id);
    }
  };

  const handleCreateBot = (strategy: StrategyConfig, allocation: number) => {
    const preset = presetById[strategy.strategyId];
    const createdAt = Date.now();

    setBots((current) => [
      {
        allocation,
        id: `bot-${strategy.strategyId}-${createdAt}`,
        lastAction: "Just now",
        market: strategy.market,
        name: `${productToDisplay(strategy.market)} ${preset.name}`,
        platform: connectedExchange ? "Coinbase Paper" : "Qonyx Paper",
        pnl: 0,
        pnlPct: 0,
        runtimeHours: 0,
        status: connectedExchange ? "Active" : "Paper",
        strategyId: strategy.strategyId,
      },
      ...current,
    ]);
    setPaperMode(true);
    setActiveView("bots");
  };

  const handleBotStatusChange = (botId: string, status: BotStatus) => {
    setBots((current) =>
      current.map((bot) => (bot.id === botId ? { ...bot, lastAction: "Just now", status } : bot)),
    );
  };

  const handleBotAllocationChange = (botId: string, change: number) => {
    setBots((current) =>
      current.map((bot) =>
        bot.id === botId
          ? {
              ...bot,
              allocation: Math.max(1000, bot.allocation + change),
              lastAction: "Just now",
            }
          : bot,
      ),
    );
  };

  return (
    <div className="app-shell">
      <AppSidebar
        activeView={activeView}
        onSelect={(view) => {
          setActiveView(view);
          setMobileNavOpen(false);
        }}
        mobileNavOpen={mobileNavOpen}
      />
      <div className="app-main">
        <AppHeader
          activeTitle={activeTitle}
          paperMode={paperMode}
          onPaperModeChange={setPaperMode}
          onFundClick={() => setFundModalOpen(true)}
          onOpenNav={() => setMobileNavOpen(true)}
          onSearchSubmit={handleSearchSubmit}
        />
        <main className="content-shell">
          {activeView === "dashboard" && (
            <DashboardView
              bots={bots}
              paperMode={paperMode}
              tradingLocked={tradingLocked}
              onOpenResearch={() => setActiveView("research")}
              onOpenRisk={() => setActiveView("risk")}
              onConfirmKill={() => setKillConfirmOpen(true)}
            />
          )}
          {activeView === "strategy" && (
            <StrategyLabView
              connectedExchange={connectedExchange}
              onCreateBot={handleCreateBot}
              paperCapital={paperCapital}
            />
          )}
          {activeView === "bots" && (
            <BotControlView
              bots={bots}
              connectedExchange={connectedExchange}
              onAllocate={handleBotAllocationChange}
              onConnectExchange={() => setConnectedExchange(true)}
              onOpenStrategy={() => setActiveView("strategy")}
              onStatusChange={handleBotStatusChange}
            />
          )}
          {activeView === "research" && <AIResearchView />}
          {activeView === "risk" && (
            <RiskCenterView
              tradingLocked={tradingLocked}
              onConfirmKill={() => setKillConfirmOpen(true)}
            />
          )}
          {activeView === "exchange" && (
            <ExchangeView connectedExchange={connectedExchange} onConnect={() => setConnectedExchange(true)} />
          )}
        </main>
      </div>
      <ConfirmModal
        open={killConfirmOpen}
        title="Lock all automated trading?"
        description="Qonyx will pause every live strategy, cancel pending orders, and keep paper trading available for review."
        confirmLabel={tradingLocked ? "Unlock Trading" : "Lock Trading"}
        danger={!tradingLocked}
        onCancel={() => setKillConfirmOpen(false)}
        onConfirm={() => {
          setTradingLocked((current) => !current);
          setKillConfirmOpen(false);
        }}
      />
      <FundingModal
        open={fundModalOpen}
        paperCapital={paperCapital}
        onCancel={() => setFundModalOpen(false)}
        onFund={(amount) => {
          setPaperCapital((current) => current + amount);
          setPaperMode(true);
          setFundModalOpen(false);
        }}
      />
    </div>
  );
}

function DashboardView({
  bots,
  paperMode,
  tradingLocked,
  onOpenResearch,
  onOpenRisk,
  onConfirmKill,
}: {
  bots: TradingBot[];
  paperMode: boolean;
  tradingLocked: boolean;
  onOpenResearch: () => void;
  onOpenRisk: () => void;
  onConfirmKill: () => void;
}) {
  const activeBots = bots.filter((bot) => bot.status === "Active");
  const totalAllocation = bots.reduce((sum, bot) => sum + bot.allocation, 0);
  const totalPnl = bots.reduce((sum, bot) => sum + bot.pnl, 0);
  const dynamicMetrics = metrics.map((metric) => {
    if (metric.label === "Portfolio Value") {
      return { ...metric, trend: `${bots.length} bots`, value: currencyFormatter.format(totalAllocation) };
    }

    if (metric.label === "Daily PnL") {
      return {
        ...metric,
        tone: totalPnl >= 0 ? "profit" : "loss",
        trend: totalPnl >= 0 ? "Sim gain" : "Sim loss",
        value: currencyFormatter.format(totalPnl),
      };
    }

    if (metric.label === "Active Strategies") {
      return { ...metric, trend: `${bots.length} total`, value: String(activeBots.length) };
    }

    return metric;
  });

  return (
    <div className="view-stack">
      <OnboardingPanel
        paperMode={paperMode}
        tradingLocked={tradingLocked}
        onOpenResearch={onOpenResearch}
        onOpenRisk={onOpenRisk}
      />
      <section className="metric-grid" aria-label="Trading metrics">
        {dynamicMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <section className="dashboard-grid">
        <ChartCard />
        <OnyxCard className="strategy-table-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Strategies</p>
              <h2>Live Strategy Stack</h2>
            </div>
            <StatusBadge variant={tradingLocked ? "risk" : "active"}>
              {tradingLocked ? "Locked" : "Running"}
            </StatusBadge>
          </div>
          <StrategyTable />
        </OnyxCard>
      </section>
      <section className="lower-grid">
        <AIInsightPanel onOpenResearch={onOpenResearch} />
        <RiskSnapshotPanel
          tradingLocked={tradingLocked}
          onOpenRisk={onOpenRisk}
          onConfirmKill={onConfirmKill}
        />
      </section>
    </div>
  );
}

function OnboardingPanel({
  paperMode,
  tradingLocked,
  onOpenResearch,
  onOpenRisk,
}: {
  paperMode: boolean;
  tradingLocked: boolean;
  onOpenResearch: () => void;
  onOpenRisk: () => void;
}) {
  return (
    <OnyxCard className="onboarding-panel reflective">
      <div className="onboarding-copy">
        <div className="inline-label">
          <Sparkles size={16} />
          Onyx Terminal
        </div>
        <h1>Qonyx Command Center</h1>
        <p>
          Monitor automated strategies, AI market signals, and risk controls in
          one polished trading workspace.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={onOpenResearch}>
            <BrainCircuit size={18} />
            Run AI Brief
          </button>
          <button className="btn btn-secondary" type="button" onClick={onOpenRisk}>
            <ShieldAlert size={18} />
            Review Risk
          </button>
        </div>
      </div>
      <div className="onboarding-status" aria-label="Onboarding status">
        <QonyxMascot className="mascot-hero" />
        <div className="status-row">
          <StatusBadge variant={paperMode ? "paper" : "active"}>
            {paperMode ? "Paper Trading" : "Live Mode"}
          </StatusBadge>
          <StatusBadge variant={tradingLocked ? "risk" : "active"}>
            {tradingLocked ? "Risk Locked" : "Risk Clear"}
          </StatusBadge>
        </div>
      </div>
    </OnyxCard>
  );
}

function StrategyLabView({
  connectedExchange,
  onCreateBot,
  paperCapital,
}: {
  connectedExchange: boolean;
  onCreateBot: (strategy: StrategyConfig, allocation: number) => void;
  paperCapital: number;
}) {
  const [strategy, setStrategy] = useState<StrategyConfig>({
    market: "BTC-USD",
    riskProfile: "Balanced",
    strategyId: "adaptive-trend",
    signal: "Momentum Breakout",
  });
  const [allocation, setAllocation] = useState(5000);
  const [draftReady, setDraftReady] = useState(false);
  const [backtestStatus, setBacktestStatus] = useState<BacktestStatus>("idle");
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const riskConfig = riskProfileConfig[strategy.riskProfile];
  const selectedPreset = presetById[strategy.strategyId];

  const updateStrategy = <K extends keyof StrategyConfig>(key: K, value: StrategyConfig[K]) => {
    setDraftReady(true);
    setBacktestStatus("idle");
    setBacktestResult(null);
    setBacktestError(null);
    setStrategy((current) => ({ ...current, [key]: value }));
  };

  const applyPreset = (presetId: StrategyPresetId) => {
    const preset = presetById[presetId];
    setDraftReady(true);
    setBacktestStatus("idle");
    setBacktestResult(null);
    setBacktestError(null);
    setAllocation(Math.min(Math.max(1000, preset.allocation), paperCapital));
    setStrategy({
      market: preset.market,
      riskProfile: preset.riskProfile,
      signal: preset.signal,
      strategyId: preset.id,
    });
  };

  const handleAllocationChange = (value: string) => {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    setAllocation(Math.max(1000, Math.min(paperCapital, parsedValue)));
  };

  const handleRunBacktest = async () => {
    setDraftReady(true);
    setBacktestStatus("running");
    setBacktestError(null);

    try {
      const candles = await fetchCoinbaseCandles({
        durationMs: 60 * 24 * 60 * 60 * 1000,
        granularity: 21600,
        product: strategy.market,
      });
      setBacktestResult(runBacktest(candles, strategy, allocation));
      setBacktestStatus("ready");
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : "Unable to run paper backtest.");
      setBacktestStatus("error");
    }
  };

  const handleCreateBot = () => {
    setDraftReady(true);
    onCreateBot(strategy, allocation);
  };

  return (
    <div className="view-stack">
      <section className="lab-grid">
        <OnyxCard className="builder-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Strategy Lab</p>
              <h2>Preset Builder</h2>
            </div>
            <StatusBadge variant={draftReady ? "paper" : "neutral"}>{draftReady ? "Draft Ready" : "Draft"}</StatusBadge>
          </div>
          <div className="control-grid">
            <SelectField
              label="Preset"
              value={strategy.strategyId}
              onChange={(value) => applyPreset(value as StrategyPresetId)}
            >
              {strategyPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Market"
              value={strategy.market}
              onChange={(value) => updateStrategy("market", value as MarketProduct)}
            >
              {strategyOptions.markets.map((market) => (
                <option key={market} value={market}>
                  {productToDisplay(market)}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Signal"
              value={strategy.signal}
              onChange={(value) => updateStrategy("signal", value as SignalType)}
            >
              {strategyOptions.signals.map((signal) => (
                <option key={signal} value={signal}>
                  {signal}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Risk Profile"
              value={strategy.riskProfile}
              onChange={(value) => updateStrategy("riskProfile", value as RiskProfile)}
            >
              {strategyOptions.riskProfiles.map((profile) => (
                <option key={profile} value={profile}>
                  {profile}
                </option>
              ))}
            </SelectField>
            <label className="field">
              <span>Bot Allocation</span>
              <input
                min={1000}
                max={paperCapital}
                step={500}
                type="number"
                value={allocation}
                onChange={(event) => handleAllocationChange(event.target.value)}
              />
            </label>
            <div className="field-readout">
              <span>Connected Platform</span>
              <strong>{connectedExchange ? "Coinbase Paper" : "Qonyx Paper"}</strong>
            </div>
          </div>
          <div className="segmented" role="tablist" aria-label="Risk profile">
            {strategyOptions.riskProfiles.map((profile) => (
              <button
                key={profile}
                className={strategy.riskProfile === profile ? "active" : ""}
                type="button"
                onClick={() => updateStrategy("riskProfile", profile)}
              >
                {profile}
              </button>
            ))}
          </div>
          <div className="strategy-summary">
            <div>
              <span>Preset type</span>
              <strong>{selectedPreset.category}</strong>
            </div>
            <div>
              <span>Max position</span>
              <strong>{plainPercentFormatter.format(riskConfig.maxPosition)}</strong>
            </div>
            <div>
              <span>Stop loss</span>
              <strong>{plainPercentFormatter.format(riskConfig.stopLoss)}</strong>
            </div>
            <div>
              <span>Take profit</span>
              <strong>{plainPercentFormatter.format(riskConfig.takeProfit)}</strong>
            </div>
          </div>
          <div className="action-row">
            <button
              className="btn btn-primary"
              type="button"
              disabled={backtestStatus === "running"}
              onClick={handleRunBacktest}
            >
              {backtestStatus === "running" ? <Activity size={18} /> : <Play size={18} />}
              {backtestStatus === "running" ? "Running Backtest" : "Start Backtest"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleCreateBot}>
              <Bot size={18} />
              Create Bot
            </button>
          </div>
        </OnyxCard>
        <OnyxCard className="preset-detail">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Selected Strategy</p>
              <h2>{selectedPreset.name}</h2>
            </div>
            <StatusBadge variant={selectedPreset.fit === "High" ? "active" : "paper"}>{selectedPreset.fit}</StatusBadge>
          </div>
          <p>{selectedPreset.note}</p>
          <div className="strategy-summary">
            <div>
              <span>Best regime</span>
              <strong>{selectedPreset.regime}</strong>
            </div>
            <div>
              <span>Bot capital</span>
              <strong>{currencyFormatter.format(allocation)}</strong>
            </div>
          </div>
        </OnyxCard>
      </section>
      <section className="preset-grid" aria-label="Mainstream strategy presets">
        {strategyPresets.map((preset) => (
          <button
            key={preset.id}
            className={cn("preset-card", strategy.strategyId === preset.id && "active")}
            type="button"
            onClick={() => applyPreset(preset.id)}
          >
            <span>{preset.category}</span>
            <strong>{preset.name}</strong>
            <em>{preset.regime}</em>
          </button>
        ))}
      </section>
      <OnyxCard className="backtest-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Backtest</p>
            <h2>Recent Result</h2>
          </div>
          <StatusBadge
            variant={
              backtestStatus === "ready"
                ? backtestResult && backtestResult.netPnl >= 0
                  ? "active"
                  : "risk"
                : backtestStatus === "running"
                  ? "paper"
                  : backtestStatus === "error"
                    ? "risk"
                    : "neutral"
            }
          >
            {backtestStatus === "ready"
              ? "Completed"
              : backtestStatus === "running"
                ? "Running"
                : backtestStatus === "error"
                  ? "Needs retry"
                  : "No result yet"}
          </StatusBadge>
        </div>
        {backtestStatus === "running" && <LoadingSkeleton rows={4} />}
        {backtestStatus === "error" && (
          <div className="chart-error">
            <AlertTriangle size={22} />
            <div>
              <strong>Backtest failed</strong>
              <p>{backtestError}</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={handleRunBacktest}>
              Retry
            </button>
          </div>
        )}
        {backtestStatus === "idle" && (
          <div className="backtest-empty">
            <CandlestickChart size={24} />
            <div>
              <strong>Ready for a paper backtest</strong>
              <p>Run the selected setup against the last 60 days of Coinbase 6 hour candles.</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={handleRunBacktest}>
              Run Now
            </button>
          </div>
        )}
        {backtestStatus === "ready" && backtestResult && <BacktestResultPanel result={backtestResult} />}
      </OnyxCard>
    </div>
  );
}

function BotControlView({
  bots,
  connectedExchange,
  onAllocate,
  onConnectExchange,
  onOpenStrategy,
  onStatusChange,
}: {
  bots: TradingBot[];
  connectedExchange: boolean;
  onAllocate: (botId: string, change: number) => void;
  onConnectExchange: () => void;
  onOpenStrategy: () => void;
  onStatusChange: (botId: string, status: BotStatus) => void;
}) {
  const activeBots = bots.filter((bot) => bot.status === "Active");
  const totalAllocation = bots.reduce((sum, bot) => sum + bot.allocation, 0);
  const totalPnl = bots.reduce((sum, bot) => sum + bot.pnl, 0);
  const bestBot = bots.reduce<TradingBot | null>((best, bot) => (!best || bot.pnl > best.pnl ? bot : best), null);

  return (
    <div className="view-stack">
      <section className="bot-hero-grid">
        <OnyxCard className="bot-command-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Bot Control</p>
              <h2>Connected Bot Stack</h2>
            </div>
            <StatusBadge variant={connectedExchange ? "active" : "paper"}>
              {connectedExchange ? "Exchange Connected" : "Paper Mode"}
            </StatusBadge>
          </div>
          <div className="bot-summary-grid">
            <BotMetric label="Bots" value={`${activeBots.length}/${bots.length}`} />
            <BotMetric label="Allocated" value={currencyFormatter.format(totalAllocation)} />
            <BotMetric
              label="PnL"
              tone={totalPnl >= 0 ? "profit" : "loss"}
              value={currencyFormatter.format(totalPnl)}
            />
            <BotMetric label="Best Bot" value={bestBot ? bestBot.name : "None"} />
          </div>
        </OnyxCard>
        <OnyxCard className="platform-card">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Platform</p>
              <h2>{connectedExchange ? "Coinbase Paper" : "Qonyx Paper"}</h2>
            </div>
            <PlugZap size={22} />
          </div>
          <p>
            {connectedExchange
              ? "Bots are connected to the simulated Coinbase paper venue for controlled testing."
              : "Connect the paper venue before promoting bots from paper to active."}
          </p>
          <button className="btn btn-secondary full-width" type="button" onClick={onConnectExchange}>
            <PlugZap size={18} />
            {connectedExchange ? "Connected" : "Connect Paper Venue"}
          </button>
        </OnyxCard>
      </section>
      <OnyxCard className="bot-table-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Bot List</p>
            <h2>Funds, Status, PnL, Runtime</h2>
          </div>
          <button className="btn btn-primary" type="button" onClick={onOpenStrategy}>
            <Layers3 size={18} />
            New Bot
          </button>
        </div>
        <div className="bot-list">
          {bots.map((bot) => {
            const preset = presetById[bot.strategyId];
            const nextStatus = bot.status === "Active" ? "Paused" : connectedExchange ? "Active" : "Paper";
            return (
              <article key={bot.id} className="bot-row">
                <div className="bot-main">
                  <div>
                    <div className="bot-title">
                      <Bot size={18} />
                      <strong>{bot.name}</strong>
                    </div>
                    <p>{preset.name} / {productToDisplay(bot.market)} / {preset.category}</p>
                  </div>
                  <StatusBadge variant={botStatusVariant(bot.status)}>{bot.status}</StatusBadge>
                </div>
                <div className="bot-stat-grid">
                  <BotMetric label="Funds" value={currencyFormatter.format(bot.allocation)} />
                  <BotMetric
                    label="PnL"
                    tone={bot.pnl >= 0 ? "profit" : "loss"}
                    value={`${currencyFormatter.format(bot.pnl)} (${percentFormatter.format(bot.pnlPct)})`}
                  />
                  <BotMetric label="Time" value={formatRuntime(bot.runtimeHours)} />
                  <BotMetric label="Platform" value={bot.platform} />
                  <BotMetric label="Last Action" value={bot.lastAction} />
                  <BotMetric label="Regime" value={preset.regime} />
                </div>
                <div className="bot-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => onAllocate(bot.id, 1000)}>
                    <CircleDollarSign size={18} />
                    Add $1k
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => onAllocate(bot.id, -1000)}>
                    <CircleDollarSign size={18} />
                    Trim $1k
                  </button>
                  <button
                    className={cn("btn", bot.status === "Active" ? "btn-danger" : "btn-primary")}
                    type="button"
                    onClick={() => onStatusChange(bot.id, nextStatus)}
                  >
                    {bot.status === "Active" ? <Pause size={18} /> : <Play size={18} />}
                    {bot.status === "Active" ? "Pause" : "Activate"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </OnyxCard>
    </div>
  );
}

function BotMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "profit" | "loss" | "warning";
  value: string;
}) {
  return (
    <div className="bot-metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function BacktestResultPanel({ result }: { result: BacktestResult }) {
  const recentTrades = result.trades.slice(-5).reverse();

  return (
    <div className="backtest-result">
      <div className="backtest-metrics">
        <BacktestMetric label="Final Equity" value={currencyFormatter.format(result.finalEquity)} />
        <BacktestMetric
          label="Net PnL"
          tone={result.netPnl >= 0 ? "profit" : "loss"}
          value={currencyFormatter.format(result.netPnl)}
        />
        <BacktestMetric
          label="Return"
          tone={result.netReturn >= 0 ? "profit" : "loss"}
          value={percentFormatter.format(result.netReturn)}
        />
        <BacktestMetric label="Win Rate" value={plainPercentFormatter.format(result.winRate)} />
        <BacktestMetric label="Max Drawdown" tone="warning" value={plainPercentFormatter.format(result.maxDrawdown)} />
        <BacktestMetric label="Trades" value={String(result.trades.length)} />
      </div>
      <div className="backtest-context">
        <StatusBadge variant="paper">{productToDisplay(result.product)}</StatusBadge>
        <StatusBadge variant="ai">{result.signal}</StatusBadge>
        <span>{result.timeRange}</span>
      </div>
      {recentTrades.length > 0 ? (
        <div className="table-wrap compact-table">
          <table>
            <thead>
              <tr>
                <th>Entry</th>
                <th>Exit</th>
                <th>Return</th>
                <th>PnL</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade) => (
                <tr key={`${trade.entryTime}-${trade.exitTime}`}>
                  <td>{currencyFormatter.format(trade.entryPrice)}</td>
                  <td>{currencyFormatter.format(trade.exitPrice)}</td>
                  <td className={trade.returnPct >= 0 ? "profit" : "loss"}>{percentFormatter.format(trade.returnPct)}</td>
                  <td className={trade.pnl >= 0 ? "profit" : "loss"}>{currencyFormatter.format(trade.pnl)}</td>
                  <td>{trade.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="backtest-empty compact">
          <LineChart size={22} />
          <div>
            <strong>No trades triggered</strong>
            <p>The strategy did not meet entry conditions during this historical window.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BacktestMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "profit" | "loss" | "warning";
  value: string;
}) {
  return (
    <div className="backtest-metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function AIResearchView() {
  const [briefStatus, setBriefStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [brief, setBrief] = useState<AiBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  const generateBrief = async () => {
    setBriefStatus("loading");
    setBriefError(null);

    try {
      const [candles, ticker] = await Promise.all([
        fetchCoinbaseCandles({
          durationMs: 24 * 60 * 60 * 1000,
          granularity: 3600,
          product: "BTC-USD",
        }),
        fetchCoinbaseTicker("BTC-USD"),
      ]);
      const firstClose = candles[0]?.close ?? 0;
      const lastClose = Number(ticker.price) || candles[candles.length - 1]?.close || firstClose;
      const change = firstClose > 0 ? (lastClose - firstClose) / firstClose : 0;
      const high = Math.max(...candles.map((candle) => candle.high));
      const low = Math.min(...candles.map((candle) => candle.low));
      const volume = candles.reduce((sum, candle) => sum + candle.volume, 0);
      const direction = change >= 0 ? "constructive" : "defensive";

      setBrief({
        bullets: [
          `24 hour move: ${percentFormatter.format(change)} from first close.`,
          `Observed range: ${currencyFormatter.format(low)} to ${currencyFormatter.format(high)}.`,
          `Coinbase spot volume: ${compactNumberFormatter.format(volume)} BTC.`,
        ],
        confidence: Math.abs(change) > 0.025 ? "82%" : "68%",
        summary: `BTC-USD conditions are ${direction}. Qonyx should keep position sizing tied to risk profile until the next confirmed reclaim or rejection.`,
        title: change >= 0 ? "Momentum remains constructive" : "Momentum is under pressure",
      });
      setBriefStatus("ready");
    } catch (error) {
      setBriefError(error instanceof Error ? error.message : "Unable to generate AI market brief.");
      setBriefStatus("error");
    }
  };

  return (
    <div className="view-stack">
      <OnyxCard className="research-welcome">
        <QonyxMascot className="mascot-research" />
        <div>
          <div className="inline-label violet">
            <Bot size={16} />
            Qonyx AI
          </div>
          <h1>AI Market Brief</h1>
          <p>
            The assistant is ready to summarize momentum, liquidity, and risk
            conditions before a strategy is deployed.
          </p>
        </div>
      </OnyxCard>
      <section className="research-grid">
        {insightCards.map((insight) => (
          <OnyxCard key={insight.title} className="insight-card">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">{insight.variant === "ai" ? "Signal" : "Guardrail"}</p>
                <h2>{insight.title}</h2>
              </div>
              <StatusBadge variant={insight.variant}>{insight.confidence}</StatusBadge>
            </div>
            <p>{insight.body}</p>
          </OnyxCard>
        ))}
      </section>
      <OnyxCard className="prompt-panel">
        <div className="prompt-input">
          <Bot size={20} />
          <span>Analyze BTC and ETH for the next session.</span>
        </div>
        <button className="btn btn-primary" type="button" disabled={briefStatus === "loading"} onClick={generateBrief}>
          {briefStatus === "loading" ? <Activity size={18} /> : <Zap size={18} />}
          {briefStatus === "loading" ? "Generating" : "Generate Brief"}
        </button>
      </OnyxCard>
      {briefStatus === "loading" && (
        <OnyxCard>
          <LoadingSkeleton rows={3} />
        </OnyxCard>
      )}
      {briefStatus === "error" && (
        <OnyxCard className="chart-error">
          <AlertTriangle size={22} />
          <div>
            <strong>Brief failed</strong>
            <p>{briefError}</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={generateBrief}>
            Retry
          </button>
        </OnyxCard>
      )}
      {briefStatus === "ready" && brief && (
        <OnyxCard className="generated-brief">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Generated Brief</p>
              <h2>{brief.title}</h2>
            </div>
            <StatusBadge variant="ai">{brief.confidence}</StatusBadge>
          </div>
          <p>{brief.summary}</p>
          <div className="brief-bullets">
            {brief.bullets.map((bullet) => (
              <div key={bullet}>
                <Sparkles size={16} />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </OnyxCard>
      )}
    </div>
  );
}

function RiskCenterView({
  tradingLocked,
  onConfirmKill,
}: {
  tradingLocked: boolean;
  onConfirmKill: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="risk-grid">
        <OnyxCard className="risk-command">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Risk Center</p>
              <h2>Portfolio Guardrails</h2>
            </div>
            <RiskBadge locked={tradingLocked} />
          </div>
          <div className="risk-meter">
            <div>
              <span>Exposure</span>
              <strong>42%</strong>
            </div>
            <div className="meter-track">
              <span style={{ width: "42%" }} />
            </div>
          </div>
          <div className="risk-list">
            <RiskItem label="Max daily loss" value="1.6% / 5.0%" tone="safe" />
            <RiskItem label="Leverage cap" value="1.8x / 3.0x" tone="safe" />
            <RiskItem label="Correlation cluster" value="Elevated" tone="warn" />
          </div>
        </OnyxCard>
        <OnyxCard className="kill-card">
          <div className="danger-mark">
            <ShieldAlert size={28} />
          </div>
          <h2>{tradingLocked ? "Trading is locked" : "Emergency Kill Switch"}</h2>
          <p>
            {tradingLocked
              ? "Automated orders are paused until the lock is removed."
              : "Pause live automation and cancel pending orders across connected venues."}
          </p>
          <KillSwitchButton locked={tradingLocked} onClick={onConfirmKill} />
        </OnyxCard>
      </section>
    </div>
  );
}

function ExchangeView({
  connectedExchange,
  onConnect,
}: {
  connectedExchange: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="exchange-grid">
        <EmptyState
          title={connectedExchange ? "Paper exchange connected" : "No exchange connected"}
          body={
            connectedExchange
              ? "Qonyx is connected to a simulated paper venue for strategy testing."
              : "Connect a paper account first, then add live venues after risk controls are configured."
          }
          actionLabel={connectedExchange ? "Connected" : "Connect Exchange"}
          icon={PlugZap}
          onAction={onConnect}
        />
        <OnyxCard>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Connection Checklist</p>
              <h2>Launch Readiness</h2>
            </div>
            <StatusBadge variant={connectedExchange ? "paper" : "paused"}>
              {connectedExchange ? "Paper Connected" : "Pending"}
            </StatusBadge>
          </div>
          <Checklist connectedExchange={connectedExchange} />
        </OnyxCard>
      </section>
    </div>
  );
}

function AppSidebar({
  activeView,
  onSelect,
  mobileNavOpen,
}: {
  activeView: View;
  onSelect: (view: View) => void;
  mobileNavOpen: boolean;
}) {
  return (
    <>
      <aside className={cn("sidebar", mobileNavOpen && "open")}>
        <div className="brand-lockup">
          <QonyxLogoIcon />
          <div>
            <strong>Qonyx</strong>
            <span>Onyx Terminal</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn("nav-item", activeView === item.id && "active")}
                type="button"
                title={item.label}
                onClick={() => onSelect(item.id)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="mini-terminal">
            <Command size={18} />
            <div>
              <span>Signal Engine</span>
              <strong>Online</strong>
            </div>
          </div>
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          className="nav-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => onSelect(activeView)}
        />
      )}
    </>
  );
}

function AppHeader({
  activeTitle,
  onFundClick,
  paperMode,
  onPaperModeChange,
  onOpenNav,
  onSearchSubmit,
}: {
  activeTitle: string;
  onFundClick: () => void;
  paperMode: boolean;
  onPaperModeChange: (enabled: boolean) => void;
  onOpenNav: () => void;
  onSearchSubmit: (query: string) => void;
}) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" type="button" title="Open menu" onClick={onOpenNav}>
        <Menu size={20} />
      </button>
      <div className="topbar-title">
        <span>Qonyx</span>
        <h2>{activeTitle}</h2>
      </div>
      <label className="search-field">
        <Search size={18} />
        <input
          aria-label="Search Qonyx"
          placeholder="Search markets, strategies, signals"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearchSubmit(searchValue);
            }
          }}
        />
      </label>
      <label className="mode-toggle">
        <input
          type="checkbox"
          checked={paperMode}
          onChange={(event) => onPaperModeChange(event.target.checked)}
        />
        <span />
        Paper
      </label>
      <button className="btn btn-secondary compact-button" type="button" onClick={onFundClick}>
        <CircleDollarSign size={18} />
        Fund
      </button>
    </header>
  );
}

function OnyxCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("onyx-card", className)}>{children}</div>;
}

function MetricCard({
  label,
  value,
  trend,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend: string;
  tone: string;
  icon: LucideIcon;
}) {
  return (
    <OnyxCard className="metric-card">
      <div className={cn("metric-icon", tone)}>
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong className="tabular-nums">{value}</strong>
      <em className={cn("metric-trend", tone)}>{trend}</em>
    </OnyxCard>
  );
}

function ChartCard() {
  const [window, setWindow] = useState<ChartWindow>("1D");
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [lastTickerPrice, setLastTickerPrice] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMarketData = async (range: ChartWindow, signal?: AbortSignal) => {
    const config = marketWindowConfig[range];
    const end = new Date();
    const start = new Date(end.getTime() - config.durationMs);
    const candleUrl = new URL("https://api.exchange.coinbase.com/products/BTC-USD/candles");
    candleUrl.searchParams.set("granularity", String(config.granularity));
    candleUrl.searchParams.set("start", start.toISOString());
    candleUrl.searchParams.set("end", end.toISOString());

    setIsLoading(true);
    setError(null);

    try {
      const [candleResponse, tickerResponse] = await Promise.all([
        fetch(candleUrl, { signal }),
        fetch("https://api.exchange.coinbase.com/products/BTC-USD/ticker", { signal }),
      ]);

      if (!candleResponse.ok || !tickerResponse.ok) {
        throw new Error("Live market data is temporarily unavailable.");
      }

      const candlePayload = await candleResponse.json();
      const tickerPayload = (await tickerResponse.json()) as TickerResponse;
      const parsedCandles = parseCoinbaseCandles(candlePayload);

      if (parsedCandles.length === 0) {
        throw new Error("Coinbase returned no BTC-USD candles for this range.");
      }

      const tickerPrice = Number(tickerPayload.price);
      setCandles(parsedCandles);
      setLastTickerPrice(
        Number.isFinite(tickerPrice) ? tickerPrice : parsedCandles[parsedCandles.length - 1]?.close ?? null,
      );
      setLastUpdated(tickerPayload.time ? new Date(tickerPayload.time) : new Date());
    } catch (loadError) {
      if (signal?.aborted) {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Unable to load live market data.");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadMarketData(window, controller.signal);

    return () => controller.abort();
  }, [window]);

  const chartPoints = getChartPoints(candles);
  const closePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.closeY.toFixed(2)}`)
    .join(" ");
  const fillPath = closePath ? `${closePath} L 100 80 L 0 80 Z` : "";
  const firstClose = candles[0]?.close ?? 0;
  const latestClose = lastTickerPrice ?? candles[candles.length - 1]?.close ?? 0;
  const change = firstClose > 0 ? (latestClose - firstClose) / firstClose : 0;
  const trendVariant: BadgeVariant = change >= 0 ? "active" : "risk";
  const totalVolume = candles.reduce((sum, candle) => sum + candle.volume, 0);
  const firstLabel = candles[0] ? formatChartTime(candles[0].time, window) : "--";
  const lastCandle = candles[candles.length - 1];
  const lastLabel = lastCandle ? formatChartTime(lastCandle.time, window) : "--";

  return (
    <OnyxCard className="chart-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Market Terminal</p>
          <h2>BTC-USD Live Flow</h2>
        </div>
        <div className="chart-actions">
          {(["1D", "1W", "1M"] as ChartWindow[]).map((range) => (
            <button
              key={range}
              className={window === range ? "active" : ""}
              type="button"
              onClick={() => setWindow(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <div className="price-row">
        <strong className="tabular-nums">{latestClose > 0 ? currencyFormatter.format(latestClose) : "--"}</strong>
        <StatusBadge variant={trendVariant}>{percentFormatter.format(change)}</StatusBadge>
      </div>
      <div className="chart-meta">
        <span>{marketWindowConfig[window].label}</span>
        <span>{firstLabel} - {lastLabel}</span>
        <span>Volume {compactNumberFormatter.format(totalVolume)} BTC</span>
        <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for ticker"}</span>
      </div>
      <div className="market-chart-wrap">
        {isLoading && (
          <div className="chart-state">
            <LoadingSkeleton rows={3} />
          </div>
        )}
        {error && !isLoading && (
          <div className="chart-error">
            <AlertTriangle size={22} />
            <div>
              <strong>Unable to load real market data</strong>
              <p>{error}</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => void loadMarketData(window)}>
              Retry
            </button>
          </div>
        )}
        {!error && chartPoints.length > 0 && (
          <svg className="market-chart" viewBox="0 0 100 80" role="img" aria-label="BTC-USD live candle chart">
            <defs>
              <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(45, 212, 191, 0.34)" />
                <stop offset="100%" stopColor="rgba(45, 212, 191, 0)" />
              </linearGradient>
            </defs>
            {fillPath && <path d={fillPath} fill="url(#chartFill)" />}
            {chartPoints.map((point) => {
              const rising = point.candle.close >= point.candle.open;
              const bodyTop = Math.min(point.openY, point.closeY);
              const bodyHeight = Math.max(Math.abs(point.openY - point.closeY), 0.8);
              return (
                <g key={point.candle.time}>
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={point.highY}
                    y2={point.lowY}
                    stroke={rising ? "#22C55E" : "#F43F5E"}
                    strokeLinecap="round"
                    strokeWidth="0.55"
                    opacity="0.74"
                  />
                  <rect
                    x={point.x - 0.55}
                    y={bodyTop}
                    width="1.1"
                    height={bodyHeight}
                    rx="0.35"
                    fill={rising ? "#22C55E" : "#F43F5E"}
                    opacity="0.82"
                  />
                </g>
              );
            })}
            {closePath && (
              <path d={closePath} fill="none" stroke="#2DD4BF" strokeLinecap="round" strokeWidth="1.8" />
            )}
          </svg>
        )}
      </div>
    </OnyxCard>
  );
}

function StrategyTable() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Market</th>
            <th>PnL</th>
            <th>Win</th>
            <th>Status</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((strategy) => (
            <tr key={strategy.name}>
              <td>{strategy.name}</td>
              <td className="mono">{strategy.market}</td>
              <td className={strategy.pnl.startsWith("+") ? "profit" : "loss"}>{strategy.pnl}</td>
              <td>{strategy.winRate}</td>
              <td>
                <StatusBadge
                  variant={
                    strategy.status === "Active"
                      ? "active"
                      : strategy.status === "Paper"
                        ? "paper"
                        : "paused"
                  }
                >
                  {strategy.status}
                </StatusBadge>
              </td>
              <td>{strategy.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AIInsightPanel({ onOpenResearch }: { onOpenResearch: () => void }) {
  return (
    <OnyxCard className="ai-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AI Research</p>
          <h2>Signal Summary</h2>
        </div>
        <StatusBadge variant="ai">Live</StatusBadge>
      </div>
      <p>
        Qonyx sees sustained momentum with elevated correlation risk. Reduce
        duplicate long exposure before adding new BTC entries.
      </p>
      <button className="btn btn-secondary" type="button" onClick={onOpenResearch}>
        <Bot size={18} />
        Open Research
      </button>
    </OnyxCard>
  );
}

function RiskSnapshotPanel({
  tradingLocked,
  onOpenRisk,
  onConfirmKill,
}: {
  tradingLocked: boolean;
  onOpenRisk: () => void;
  onConfirmKill: () => void;
}) {
  return (
    <OnyxCard className="risk-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Risk</p>
          <h2>Guard Status</h2>
        </div>
        <RiskBadge locked={tradingLocked} />
      </div>
      <div className="risk-actions">
        <button className="btn btn-secondary" type="button" onClick={onOpenRisk}>
          <Gauge size={18} />
          Open Center
        </button>
        <KillSwitchButton locked={tradingLocked} onClick={onConfirmKill} compact />
      </div>
    </OnyxCard>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  icon: Icon,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  icon: LucideIcon;
  onAction: () => void;
}) {
  return (
    <OnyxCard className="empty-state">
      <QonyxMascot className="mascot-empty" />
      <div className="empty-copy">
        <div className="empty-icon">
          <Icon size={18} />
        </div>
        <h2>{title}</h2>
        <p>{body}</p>
        <button className="btn btn-primary" type="button" onClick={onAction}>
          <Sparkles size={18} />
          {actionLabel}
        </button>
      </div>
    </OnyxCard>
  );
}

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="skeleton-stack" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} className="skeleton-row" />
      ))}
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal-card onyx-card">
        <button className="icon-button modal-close" type="button" title="Close" onClick={onCancel}>
          <X size={18} />
        </button>
        <div className={cn("modal-icon", danger && "danger")}>
          {danger ? <ShieldAlert size={24} /> : <LockKeyhole size={24} />}
        </div>
        <h2 id="confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={cn("btn", danger ? "btn-danger" : "btn-primary")}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function FundingModal({
  open,
  paperCapital,
  onCancel,
  onFund,
}: {
  open: boolean;
  paperCapital: number;
  onCancel: () => void;
  onFund: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(25000);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="fund-title">
      <div className="modal-card onyx-card">
        <button className="icon-button modal-close" type="button" title="Close" onClick={onCancel}>
          <X size={18} />
        </button>
        <div className="modal-icon">
          <CircleDollarSign size={24} />
        </div>
        <h2 id="fund-title">Add Paper Capital</h2>
        <p>Increase the simulated account balance used by Qonyx strategy testing.</p>
        <div className="funding-balance">
          <span>Current paper capital</span>
          <strong>{currencyFormatter.format(paperCapital)}</strong>
        </div>
        <div className="amount-grid" aria-label="Paper funding amount">
          {[10000, 25000, 50000].map((option) => (
            <button
              key={option}
              className={amount === option ? "active" : ""}
              type="button"
              onClick={() => setAmount(option)}
            >
              {currencyFormatter.format(option)}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button" onClick={() => onFund(amount)}>
            Add Funds
          </button>
        </div>
      </div>
    </div>
  );
}

function KillSwitchButton({
  locked,
  compact,
  onClick,
}: {
  locked: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn("btn", locked ? "btn-secondary" : "btn-danger", compact && "compact-button")}
      type="button"
      onClick={onClick}
    >
      {locked ? <Play size={18} /> : <Pause size={18} />}
      {locked ? "Unlock" : "Kill Switch"}
    </button>
  );
}

function StatusBadge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  return <span className={cn("status-badge", variant)}>{children}</span>;
}

function RiskBadge({ locked }: { locked: boolean }) {
  return <StatusBadge variant={locked ? "risk" : "active"}>{locked ? "Blocked" : "Clear"}</StatusBadge>;
}

function SelectField({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="select-control">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
        <ChevronDown size={16} />
      </div>
    </label>
  );
}

function RiskItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "safe" | "warn";
}) {
  return (
    <div className="risk-item">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function Checklist({ connectedExchange }: { connectedExchange: boolean }) {
  const items = [
    ["Paper keys added", true],
    ["Risk limits reviewed", true],
    ["Paper venue connected", connectedExchange],
    ["Strategy promoted", false],
  ] as const;

  return (
    <div className="checklist">
      {items.map(([label, complete]) => (
        <div key={label} className="check-row">
          <span className={complete ? "complete" : ""} />
          <p>{label}</p>
        </div>
      ))}
    </div>
  );
}

function QonyxLogoIcon({ className }: { className?: string }) {
  return (
    <img
      className={cn("qonyx-logo", className)}
      src="/brand/qonyx-logo-icon.png"
      alt="Qonyx logo"
      width="44"
      height="44"
    />
  );
}

function QonyxMascot({ className }: { className?: string }) {
  return (
    <img
      className={cn("qonyx-mascot", className)}
      src="/brand/qonyx-mascot.png"
      alt="Qonyx mascot"
      width="220"
      height="220"
    />
  );
}
