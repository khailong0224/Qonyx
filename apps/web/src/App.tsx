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

type View = "dashboard" | "strategy" | "research" | "risk" | "exchange";
type BadgeVariant = "active" | "paused" | "risk" | "paper" | "ai" | "neutral";
type ChartWindow = "1D" | "1W" | "1M";
type MarketProduct = "BTC-USD" | "ETH-USD" | "SOL-USD";
type SignalType = "VWAP Reclaim" | "Momentum Breakout" | "Mean Reversion";
type RiskProfile = "Conservative" | "Balanced" | "Aggressive";
type BacktestStatus = "idle" | "running" | "ready" | "error";

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

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Command", icon: BarChart3 },
  { id: "strategy", label: "Strategy Lab", icon: Layers3 },
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
  markets: ["BTC-USD", "ETH-USD", "SOL-USD"] as MarketProduct[],
  riskProfiles: ["Conservative", "Balanced", "Aggressive"] as RiskProfile[],
  signals: ["VWAP Reclaim", "Momentum Breakout", "Mean Reversion"] as SignalType[],
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

function cycleValue<T>(values: readonly T[], current: T) {
  const index = values.findIndex((value) => value === current);
  return values[(index + 1) % values.length];
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

  if (signal === "VWAP Reclaim") {
    return previous.close <= previousVwap && candle.close > currentVwap && fastAverage >= slowAverage;
  }

  if (signal === "Momentum Breakout") {
    return candle.close > priorHigh && fastAverage > slowAverage;
  }

  return candle.close < slowAverage * 0.982 && candle.close > candle.open;
}

function shouldExitTrade(candles: MarketCandle[], index: number, signal: SignalType, entryPrice: number, riskProfile: RiskProfile) {
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

  if (signal === "VWAP Reclaim" && candle.close < currentVwap) {
    return { price: candle.close, reason: "VWAP lost" };
  }

  if (signal === "Momentum Breakout" && candle.close < slowAverage) {
    return { price: candle.close, reason: "Momentum faded" };
  }

  if (signal === "Mean Reversion" && candle.close >= slowAverage) {
    return { price: candle.close, reason: "Mean reached" };
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
  let openTrade: { entryPrice: number; entryTime: number; size: number } | null = null;

  for (let index = 12; index < candles.length; index += 1) {
    const candle = candles[index];

    if (!openTrade && shouldEnterTrade(candles, index, strategy.signal)) {
      openTrade = {
        entryPrice: candle.close,
        entryTime: candle.time,
        size: equity * config.maxPosition,
      };
      continue;
    }

    if (openTrade) {
      const exit = shouldExitTrade(candles, index, strategy.signal, openTrade.entryPrice, strategy.riskProfile);
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
              paperMode={paperMode}
              tradingLocked={tradingLocked}
              onOpenResearch={() => setActiveView("research")}
              onOpenRisk={() => setActiveView("risk")}
              onConfirmKill={() => setKillConfirmOpen(true)}
            />
          )}
          {activeView === "strategy" && <StrategyLabView paperCapital={paperCapital} />}
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
  paperMode,
  tradingLocked,
  onOpenResearch,
  onOpenRisk,
  onConfirmKill,
}: {
  paperMode: boolean;
  tradingLocked: boolean;
  onOpenResearch: () => void;
  onOpenRisk: () => void;
  onConfirmKill: () => void;
}) {
  return (
    <div className="view-stack">
      <OnboardingPanel
        paperMode={paperMode}
        tradingLocked={tradingLocked}
        onOpenResearch={onOpenResearch}
        onOpenRisk={onOpenRisk}
      />
      <section className="metric-grid" aria-label="Trading metrics">
        {metrics.map((metric) => (
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

function StrategyLabView({ paperCapital }: { paperCapital: number }) {
  const [strategy, setStrategy] = useState<StrategyConfig>({
    market: "BTC-USD",
    riskProfile: "Conservative",
    signal: "VWAP Reclaim",
  });
  const [draftReady, setDraftReady] = useState(false);
  const [backtestStatus, setBacktestStatus] = useState<BacktestStatus>("idle");
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const riskConfig = riskProfileConfig[strategy.riskProfile];

  const updateStrategy = <K extends keyof StrategyConfig>(key: K, value: StrategyConfig[K]) => {
    setDraftReady(true);
    setBacktestStatus("idle");
    setBacktestResult(null);
    setBacktestError(null);
    setStrategy((current) => ({ ...current, [key]: value }));
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
      setBacktestResult(runBacktest(candles, strategy, paperCapital));
      setBacktestStatus("ready");
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : "Unable to run paper backtest.");
      setBacktestStatus("error");
    }
  };

  return (
    <div className="view-stack">
      <section className="lab-grid">
        <OnyxCard className="builder-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Strategy Lab</p>
              <h2>Momentum Builder</h2>
            </div>
            <StatusBadge variant={draftReady ? "paper" : "neutral"}>{draftReady ? "Draft Ready" : "Draft"}</StatusBadge>
          </div>
          <div className="control-grid">
            <OptionField
              label="Market"
              value={productToDisplay(strategy.market)}
              onClick={() => updateStrategy("market", cycleValue(strategyOptions.markets, strategy.market))}
            />
            <OptionField
              label="Signal"
              value={strategy.signal}
              onClick={() => updateStrategy("signal", cycleValue(strategyOptions.signals, strategy.signal))}
            />
            <OptionField
              label="Max Position"
              value={plainPercentFormatter.format(riskConfig.maxPosition)}
              onClick={() =>
                updateStrategy("riskProfile", cycleValue(strategyOptions.riskProfiles, strategy.riskProfile))
              }
            />
            <OptionField
              label="Stop Loss"
              value={plainPercentFormatter.format(riskConfig.stopLoss)}
              onClick={() =>
                updateStrategy("riskProfile", cycleValue(strategyOptions.riskProfiles, strategy.riskProfile))
              }
            />
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
              <span>Paper capital</span>
              <strong>{currencyFormatter.format(paperCapital)}</strong>
            </div>
            <div>
              <span>Take profit</span>
              <strong>{plainPercentFormatter.format(riskConfig.takeProfit)}</strong>
            </div>
          </div>
          <button
            className="btn btn-primary full-width"
            type="button"
            disabled={backtestStatus === "running"}
            onClick={handleRunBacktest}
          >
            {backtestStatus === "running" ? <Activity size={18} /> : <Play size={18} />}
            {backtestStatus === "running" ? "Running Backtest" : "Start Paper Backtest"}
          </button>
        </OnyxCard>
        <EmptyState
          title="Create your first Qonyx strategy"
          body={`${productToDisplay(strategy.market)} ${strategy.signal} is staged with ${strategy.riskProfile.toLowerCase()} risk.`}
          actionLabel={draftReady ? "Run Backtest" : "Build Strategy"}
          icon={Layers3}
          onAction={draftReady ? handleRunBacktest : () => setDraftReady(true)}
        />
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

function OptionField({
  label,
  onClick,
  value,
}: {
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <button type="button" onClick={onClick}>
        {value}
        <ChevronDown size={16} />
      </button>
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
