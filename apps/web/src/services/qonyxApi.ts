export type AiProviderKind = "sandbox" | "openai-compatible" | "ollama";
export type ExchangePlatform =
  | "paper"
  | "binance"
  | "bitget"
  | "bybit"
  | "moomoo"
  | "webhook";
export type RunStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "completed"
  | "failed"
  | "risk-blocked";

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

export type AgentRunInput = {
  agents: {
    analyst: {
      connectionId?: string;
      instructions?: string;
      name: string;
      role: "analyst";
    };
    reporter: {
      connectionId?: string;
      instructions?: string;
      name: string;
      role: "reporter";
    };
    trader: {
      connectionId?: string;
      instructions?: string;
      name: string;
      role: "trader";
    };
  };
  cycleIntervalMs: number;
  exchangeConnectionId?: string;
  maxCycles: number;
  mode: "paper" | "live";
  name: string;
  platform: ExchangePlatform;
  risk: {
    capitalLimitUsd: number;
    dailyLossLimitUsd: number;
    maxOrderUsd: number;
    maxPositionPercent: number;
  };
  symbol: string;
};

export type AccountSnapshot = {
  availableCashUsd: number;
  equityUsd: number;
  exposureUsd: number;
  positionBase: number;
  realizedPnlUsd: number;
  symbol: string;
};

export type AgentStep = {
  completedAt: string;
  error?: string;
  name: string;
  output?: unknown;
  role: "analyst" | "trader" | "reporter";
  startedAt: string;
  status: "completed" | "failed" | "skipped";
};

export type RunEvent = {
  category: "agent" | "order" | "risk" | "run" | "system";
  cycleSequence?: number;
  durationMs?: number;
  id: string;
  level: "error" | "info" | "warning";
  message: string;
  metadata?: Record<string, boolean | number | string>;
  role?: "analyst" | "trader" | "reporter";
  timestamp: string;
};

export type RunCycle = {
  accountAfter: AccountSnapshot;
  accountBefore: AccountSnapshot;
  analysis: {
    confidence: number;
    direction: "bullish" | "bearish" | "neutral";
    rationale: string;
    riskFlags: string[];
    signals: string[];
    summary: string;
  };
  completedAt: string;
  id: string;
  market: {
    changePercent24h: number;
    price: number;
    symbol: string;
  };
  order?: {
    action: "buy" | "sell";
    averagePrice: number;
    id: string;
    notionalUsd: number;
    status: string;
  };
  report: {
    action: string;
    budgetSummary: string;
    headline: string;
    narrative: string;
    riskSummary: string;
  };
  risk: {
    approved: boolean;
    remainingBudgetUsd: number;
    violations: string[];
  };
  sequence: number;
  steps: AgentStep[];
  tradeIntent: {
    action: "buy" | "sell" | "hold";
    notionalUsd: number;
    reason: string;
  };
};

export type AgentRun = {
  config: AgentRunInput;
  createdAt: string;
  cycles: RunCycle[];
  events: RunEvent[];
  id: string;
  lastError?: string;
  status: RunStatus;
  stopReason?: string;
  updatedAt: string;
};

export class QonyxApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "QonyxApiError";
    this.status = status;
  }
}

let sessionToken = "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(sessionToken ? { "X-Qonyx-Session": sessionToken } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      issues?: Array<{ message: string; path: string }>;
    };
    const details = payload.issues?.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new QonyxApiError(
      [payload.error || `API request failed with HTTP ${response.status}.`, details]
        .filter(Boolean)
        .join(" "),
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const qonyxApi = {
  clearSessionToken() {
    sessionToken = "";
  },
  createAiConnection(input: {
    apiKey?: string;
    baseUrl?: string;
    label: string;
    model: string;
    provider: AiProviderKind;
  }) {
    return request<{ connection: ConnectionSummary }>("/api/connections/ai", {
      body: JSON.stringify(input),
      method: "POST",
    });
  },
  createExchangeConnection(input: {
    apiKey?: string;
    baseUrl?: string;
    label: string;
    passphrase?: string;
    platform: ExchangePlatform;
    sandbox: boolean;
    secret?: string;
  }) {
    return request<{ connection: ConnectionSummary }>("/api/connections/exchange", {
      body: JSON.stringify(input),
      method: "POST",
    });
  },
  deleteConnection(id: string) {
    return request<void>(`/api/connections/${id}`, { method: "DELETE" });
  },
  emergencyStop(reason = "Emergency stop activated from Qonyx web") {
    return request<{
      cancellationFailures: string[];
      halted: boolean;
      stoppedRuns: string[];
    }>(
      "/api/system/emergency-stop",
      {
        body: JSON.stringify({ reason }),
        method: "POST",
      },
    );
  },
  getConnections() {
    return request<{ connections: ConnectionSummary[] }>("/api/connections");
  },
  getHealth() {
    return request<{
      mainnetTradingEnabled: boolean;
      liveTradingEnabled: boolean;
      service: string;
      status: string;
      time: string;
    }>("/api/health");
  },
  getPlatforms() {
    return request<{ platforms: PlatformCapability[] }>("/api/platforms");
  },
  getRun(id: string) {
    return request<{ run: AgentRun }>(`/api/agent-runs/${id}`);
  },
  getRunEvents(id: string) {
    return request<{ events: RunEvent[] }>(`/api/agent-runs/${id}/events`);
  },
  getRuns() {
    return request<{ runs: AgentRun[] }>("/api/agent-runs");
  },
  getSystemStatus() {
    return request<{
      halted: boolean;
      liveTradingEnabled: boolean;
      mainnetTradingEnabled: boolean;
    }>("/api/system/status");
  },
  runCycle(id: string) {
    return request<{ run: AgentRun }>(`/api/agent-runs/${id}/cycle`, {
      method: "POST",
    });
  },
  setSessionToken(value: string) {
    sessionToken = value.trim();
  },
  startRun(input: AgentRunInput) {
    return request<{ run: AgentRun }>("/api/agent-runs", {
      body: JSON.stringify(input),
      method: "POST",
    });
  },
  stopRun(id: string, reason = "Stopped from Qonyx web") {
    return request<{ run: AgentRun }>(`/api/agent-runs/${id}/stop`, {
      body: JSON.stringify({ reason }),
      method: "POST",
    });
  },
  testConnection(id: string) {
    return request<{ message: string; ok: boolean }>(`/api/connections/${id}/test`, {
      method: "POST",
    });
  },
  unlock() {
    return request<{ halted: boolean }>("/api/system/unlock", { method: "POST" });
  },
};
