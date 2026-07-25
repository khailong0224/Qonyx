export type AiProviderKind = "sandbox" | "openai-compatible" | "ollama";

export type ExchangePlatform =
  | "paper"
  | "binance"
  | "bitget"
  | "bybit"
  | "moomoo"
  | "webhook";

export type TradingMode = "paper" | "live";
export type AgentRole = "analyst" | "trader" | "reporter";
export type RunEventCategory = "agent" | "order" | "risk" | "run" | "system";
export type RunEventLevel = "error" | "info" | "warning";
export type RunStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "completed"
  | "failed"
  | "risk-blocked";

export type AgentConfig = {
  name: string;
  role: AgentRole;
  connectionId?: string;
  model?: string;
  instructions?: string;
};

export type RiskLimits = {
  capitalLimitUsd: number;
  dailyLossLimitUsd: number;
  maxOrderUsd: number;
  maxPositionPercent: number;
};

export type AgentRunConfig = {
  agents: {
    analyst: AgentConfig;
    reporter: AgentConfig;
    trader: AgentConfig;
  };
  cycleIntervalMs: number;
  exchangeConnectionId?: string;
  maxCycles: number;
  mode: TradingMode;
  name: string;
  platform: ExchangePlatform;
  risk: RiskLimits;
  symbol: string;
};

export type MarketSnapshot = {
  ask: number;
  bid: number;
  changePercent24h: number;
  price: number;
  symbol: string;
  timestamp: string;
  volume24h: number;
};

export type AnalysisDirection = "bullish" | "bearish" | "neutral";

export type AnalysisResult = {
  confidence: number;
  direction: AnalysisDirection;
  rationale: string;
  riskFlags: string[];
  signals: string[];
  summary: string;
};

export type TradeAction = "buy" | "sell" | "hold";
export type OrderType = "market" | "limit";

export type TradeIntent = {
  action: TradeAction;
  limitPrice?: number;
  notionalUsd: number;
  orderType: OrderType;
  reason: string;
};

export type AccountSnapshot = {
  availableCashUsd: number;
  equityUsd: number;
  exposureUsd: number;
  positionBase: number;
  realizedPnlUsd: number;
  symbol: string;
};

export type RiskDecision = {
  approved: boolean;
  intent: TradeIntent;
  remainingBudgetUsd: number;
  violations: string[];
};

export type OrderResult = {
  action: Exclude<TradeAction, "hold">;
  amountBase: number;
  averagePrice: number;
  feeUsd: number;
  id: string;
  notionalUsd: number;
  platform: ExchangePlatform;
  requestedNotionalUsd?: number;
  status: "filled" | "open" | "cancelled" | "rejected";
  symbol: string;
  timestamp: string;
};

export type AgentStep = {
  completedAt: string;
  error?: string;
  name: string;
  output?: unknown;
  role: AgentRole;
  startedAt: string;
  status: "completed" | "failed" | "skipped";
};

export type TradingReport = {
  action: string;
  budgetSummary: string;
  headline: string;
  narrative: string;
  riskSummary: string;
};

export type RunCycle = {
  accountAfter: AccountSnapshot;
  accountBefore: AccountSnapshot;
  analysis: AnalysisResult;
  completedAt: string;
  id: string;
  market: MarketSnapshot;
  order?: OrderResult;
  report: TradingReport;
  risk: RiskDecision;
  sequence: number;
  startedAt: string;
  steps: AgentStep[];
  tradeIntent: TradeIntent;
};

export type RunEvent = {
  category: RunEventCategory;
  cycleSequence?: number;
  durationMs?: number;
  id: string;
  level: RunEventLevel;
  message: string;
  metadata?: Record<string, boolean | number | string>;
  role?: AgentRole;
  timestamp: string;
};

export type AgentRun = {
  config: AgentRunConfig;
  createdAt: string;
  cycles: RunCycle[];
  events: RunEvent[];
  id: string;
  lastError?: string;
  startedAt?: string;
  status: RunStatus;
  stopReason?: string;
  stoppedAt?: string;
  updatedAt: string;
};

export type AiConnectionSecret = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  provider: AiProviderKind;
};

export type ExchangeConnectionSecret = {
  apiKey?: string;
  baseUrl?: string;
  passphrase?: string;
  platform: ExchangePlatform;
  sandbox: boolean;
  secret?: string;
};

export type ConnectionSummary = {
  baseUrl?: string;
  createdAt: string;
  id: string;
  kind: "ai" | "exchange";
  label: string;
  model?: string;
  platform?: ExchangePlatform;
  provider?: AiProviderKind;
  sandbox?: boolean;
  secretLast4?: string;
};

export type PlatformCapability = {
  id: ExchangePlatform;
  label: string;
  liveTrading: boolean;
  note: string;
  sandbox: boolean;
};

export interface ExchangeAdapter {
  cancelAllOrders(symbol: string): Promise<void>;
  getAccount(symbol: string): Promise<AccountSnapshot>;
  getMarketSnapshot(symbol: string, signal?: AbortSignal): Promise<MarketSnapshot>;
  placeOrder(intent: TradeIntent, symbol: string): Promise<OrderResult>;
  readonly platform: ExchangePlatform;
  testConnection(): Promise<{ message: string; ok: boolean }>;
}

export interface AiAgentProvider {
  analyze(
    agent: AgentConfig,
    market: MarketSnapshot,
    account: AccountSnapshot,
    signal: AbortSignal,
  ): Promise<AnalysisResult>;
  report(
    agent: AgentConfig,
    context: {
      accountAfter: AccountSnapshot;
      analysis: AnalysisResult;
      intent: TradeIntent;
      order?: OrderResult;
      risk: RiskDecision;
    },
    signal: AbortSignal,
  ): Promise<TradingReport>;
  trade(
    agent: AgentConfig,
    context: {
      account: AccountSnapshot;
      analysis: AnalysisResult;
      market: MarketSnapshot;
      riskLimits: RiskLimits;
    },
    signal: AbortSignal,
  ): Promise<TradeIntent>;
}
