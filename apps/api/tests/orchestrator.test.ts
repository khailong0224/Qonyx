import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  AgentRunConfig,
  AiAgentProvider,
  ExchangeAdapter,
  OrderResult,
} from "../src/domain.js";
import { PaperExchangeAdapter } from "../src/exchanges/paperExchange.js";
import { RoutedAiAgentProvider } from "../src/services/aiProvider.js";
import { CredentialVault } from "../src/services/credentialVault.js";
import { SyntheticMarketDataSource } from "../src/services/marketData.js";
import { AgentOrchestrator } from "../src/services/orchestrator.js";

const runConfig: AgentRunConfig = {
  agents: {
    analyst: { name: "Atlas", role: "analyst" },
    reporter: { name: "Ledger", role: "reporter" },
    trader: { name: "Vector", role: "trader" },
  },
  cycleIntervalMs: 5_000,
  maxCycles: 1,
  mode: "paper",
  name: "Three-agent sandbox",
  platform: "paper",
  risk: {
    capitalLimitUsd: 1_000,
    dailyLossLimitUsd: 100,
    maxOrderUsd: 300,
    maxPositionPercent: 0.25,
  },
  symbol: "BTC/USD",
};

describe("AgentOrchestrator", () => {
  it("passes analysis to trader, enforces risk, and creates a report", async () => {
    const provider = new RoutedAiAgentProvider(new CredentialVault());
    const exchange = new PaperExchangeAdapter(
      runConfig.risk.capitalLimitUsd,
      new SyntheticMarketDataSource(100),
    );
    const orchestrator = new AgentOrchestrator(
      provider,
      { createForRun: () => exchange },
      { autoSchedule: false },
    );

    const started = await orchestrator.startRun(runConfig);
    const completed = await orchestrator.runOneCycle(started.id);
    const cycle = completed.cycles[0];

    expect(completed.status).toBe("completed");
    expect(cycle.steps.map((step) => step.role)).toEqual([
      "analyst",
      "trader",
      "reporter",
    ]);
    expect(cycle.accountAfter.exposureUsd).toBeLessThanOrEqual(
      runConfig.risk.capitalLimitUsd * runConfig.risk.maxPositionPercent + 1,
    );
    expect(cycle.report.headline.length).toBeGreaterThan(0);
    expect(completed.events.map((event) => event.category)).toEqual(
      expect.arrayContaining(["agent", "risk", "run", "system"]),
    );
    expect(
      completed.events
        .filter((event) => event.category === "agent")
        .map((event) => event.role),
    ).toEqual(["analyst", "trader", "reporter"]);
    expect(
      completed.events.find((event) => event.message === "Cycle 1 completed.")
        ?.durationMs,
    ).toBeGreaterThanOrEqual(0);
    expect(new Set(completed.events.map((event) => event.id)).size).toBe(
      completed.events.length,
    );
  });

  it("records the failing agent stage before stopping a run", async () => {
    const provider: AiAgentProvider = {
      analyze: async () => ({
        confidence: 0.9,
        direction: "bullish",
        rationale: "Test",
        riskFlags: [],
        signals: ["Test"],
        summary: "Bullish test",
      }),
      report: async () => ({
        action: "Test",
        budgetSummary: "Test",
        headline: "Test",
        narrative: "Test",
        riskSummary: "Test",
      }),
      trade: async () => {
        throw new Error("provider unavailable");
      },
    };
    const orchestrator = new AgentOrchestrator(
      provider,
      {
        createForRun: () =>
          new PaperExchangeAdapter(1_000, new SyntheticMarketDataSource(100)),
      },
      { autoSchedule: false },
    );
    const run = await orchestrator.startRun(runConfig);

    const failed = await orchestrator.runOneCycle(run.id);
    const traderFailure = failed.events.find(
      (event) => event.role === "trader" && event.level === "error",
    );

    expect(failed.status).toBe("failed");
    expect(traderFailure).toMatchObject({
      category: "agent",
      cycleSequence: 1,
      message: "Vector failed while preparing a trade intent.",
    });
    expect(traderFailure?.metadata?.error).toBe("provider unavailable");
  });

  it("force-stops a run and globally blocks new runs until unlock", async () => {
    const provider = new RoutedAiAgentProvider(new CredentialVault());
    const orchestrator = new AgentOrchestrator(
      provider,
      {
        createForRun: () =>
          new PaperExchangeAdapter(1_000, new SyntheticMarketDataSource(100)),
      },
      { autoSchedule: false },
    );
    const run = await orchestrator.startRun({ ...runConfig, maxCycles: 0 });

    const result = await orchestrator.emergencyStop("Test kill switch");

    expect(result.stoppedRuns).toContain(run.id);
    expect(result.cancellationFailures).toEqual([]);
    expect(orchestrator.getRun(run.id)?.status).toBe("stopped");
    expect(orchestrator.getRun(run.id)?.events.map((event) => event.message)).toEqual(
      expect.arrayContaining(["Stop requested.", "Run stopped."]),
    );
    await expect(orchestrator.startRun(runConfig)).rejects.toThrow(/Emergency stop/);
    expect(orchestrator.unlock()).toEqual({ halted: false });
  });

  it("counts open buy orders against the same hard fund ceiling", async () => {
    const openOrders: number[] = [];
    const provider: AiAgentProvider = {
      analyze: async () => ({
        confidence: 0.9,
        direction: "bullish",
        rationale: "Test",
        riskFlags: [],
        signals: ["Test"],
        summary: "Bullish test",
      }),
      report: async () => ({
        action: "Test",
        budgetSummary: "Test",
        headline: "Test",
        narrative: "Test",
        riskSummary: "Test",
      }),
      trade: async () => ({
        action: "buy",
        notionalUsd: 1_000,
        orderType: "limit",
        reason: "Open-order reservation test",
      }),
    };
    const adapter: ExchangeAdapter = {
      cancelAllOrders: async () => undefined,
      getAccount: async (symbol) => ({
        availableCashUsd: 10_000,
        equityUsd: 10_000,
        exposureUsd: 0,
        positionBase: 0,
        realizedPnlUsd: 0,
        symbol,
      }),
      getMarketSnapshot: async (symbol) => ({
        ask: 101,
        bid: 99,
        changePercent24h: 1,
        price: 100,
        symbol,
        timestamp: new Date().toISOString(),
        volume24h: 1_000,
      }),
      placeOrder: async (intent, symbol) => {
        openOrders.push(intent.notionalUsd);
        return {
          action: "buy",
          amountBase: intent.notionalUsd / 100,
          averagePrice: 100,
          feeUsd: 0,
          id: randomUUID(),
          notionalUsd: intent.notionalUsd,
          platform: "paper",
          status: "open",
          symbol,
          timestamp: new Date().toISOString(),
        };
      },
      platform: "paper",
      testConnection: async () => ({ message: "Test", ok: true }),
    };
    const orchestrator = new AgentOrchestrator(
      provider,
      { createForRun: () => adapter },
      { autoSchedule: false },
    );
    const run = await orchestrator.startRun({
      ...runConfig,
      maxCycles: 0,
      risk: {
        capitalLimitUsd: 1_000,
        dailyLossLimitUsd: 100,
        maxOrderUsd: 400,
        maxPositionPercent: 0.25,
      },
    });

    await orchestrator.runOneCycle(run.id);
    await orchestrator.runOneCycle(run.id);

    expect(openOrders.reduce((total, value) => total + value, 0)).toBeLessThanOrEqual(
      250,
    );
    expect(openOrders).toEqual([250]);
  });

  it("does not reserve the same long position for multiple open sell orders", async () => {
    const openOrders: number[] = [];
    const provider: AiAgentProvider = {
      analyze: async () => ({
        confidence: 0.9,
        direction: "bearish",
        rationale: "Test",
        riskFlags: [],
        signals: ["Test"],
        summary: "Bearish test",
      }),
      report: async () => ({
        action: "Test",
        budgetSummary: "Test",
        headline: "Test",
        narrative: "Test",
        riskSummary: "Test",
      }),
      trade: async () => ({
        action: "sell",
        limitPrice: 100,
        notionalUsd: 1_000,
        orderType: "limit",
        reason: "Open sell reservation test",
      }),
    };
    const adapter: ExchangeAdapter = {
      cancelAllOrders: async () => undefined,
      getAccount: async (symbol) => ({
        availableCashUsd: 0,
        equityUsd: 1_000,
        exposureUsd: 1_000,
        positionBase: 10,
        realizedPnlUsd: 0,
        symbol,
      }),
      getMarketSnapshot: async (symbol) => ({
        ask: 101,
        bid: 99,
        changePercent24h: -1,
        price: 100,
        symbol,
        timestamp: new Date().toISOString(),
        volume24h: 1_000,
      }),
      placeOrder: async (intent, symbol) => {
        openOrders.push(intent.notionalUsd);
        return {
          action: "sell",
          amountBase: 0,
          averagePrice: 100,
          feeUsd: 0,
          id: randomUUID(),
          notionalUsd: 0,
          platform: "paper",
          requestedNotionalUsd: intent.notionalUsd,
          status: "open",
          symbol,
          timestamp: new Date().toISOString(),
        };
      },
      platform: "paper",
      testConnection: async () => ({ message: "Test", ok: true }),
    };
    const orchestrator = new AgentOrchestrator(
      provider,
      { createForRun: () => adapter },
      { autoSchedule: false },
    );
    const run = await orchestrator.startRun({
      ...runConfig,
      maxCycles: 0,
      risk: {
        capitalLimitUsd: 1_000,
        dailyLossLimitUsd: 100,
        maxOrderUsd: 1_000,
        maxPositionPercent: 1,
      },
    });

    await orchestrator.runOneCycle(run.id);
    await orchestrator.runOneCycle(run.id);

    expect(openOrders).toEqual([1_000]);
  });

  it("cancels again when force stop races an in-flight order submission", async () => {
    let cancelCount = 0;
    let markOrderStarted!: () => void;
    let resolveOrder!: (order: OrderResult) => void;
    const orderStarted = new Promise<void>((resolve) => {
      markOrderStarted = resolve;
    });
    const pendingOrder = new Promise<OrderResult>((resolve) => {
      resolveOrder = resolve;
    });
    const provider: AiAgentProvider = {
      analyze: async () => ({
        confidence: 0.9,
        direction: "bullish",
        rationale: "Test",
        riskFlags: [],
        signals: ["Test"],
        summary: "Bullish test",
      }),
      report: async () => ({
        action: "Test",
        budgetSummary: "Test",
        headline: "Test",
        narrative: "Test",
        riskSummary: "Test",
      }),
      trade: async () => ({
        action: "buy",
        notionalUsd: 100,
        orderType: "market",
        reason: "Stop race test",
      }),
    };
    const adapter: ExchangeAdapter = {
      cancelAllOrders: async () => {
        cancelCount += 1;
      },
      getAccount: async (symbol) => ({
        availableCashUsd: 1_000,
        equityUsd: 1_000,
        exposureUsd: 0,
        positionBase: 0,
        realizedPnlUsd: 0,
        symbol,
      }),
      getMarketSnapshot: async (symbol) => ({
        ask: 101,
        bid: 99,
        changePercent24h: 1,
        price: 100,
        symbol,
        timestamp: new Date().toISOString(),
        volume24h: 1_000,
      }),
      placeOrder: async () => {
        markOrderStarted();
        return pendingOrder;
      },
      platform: "paper",
      testConnection: async () => ({ message: "Test", ok: true }),
    };
    const orchestrator = new AgentOrchestrator(
      provider,
      { createForRun: () => adapter },
      { autoSchedule: false },
    );
    const run = await orchestrator.startRun({ ...runConfig, maxCycles: 0 });
    const cycle = orchestrator.runOneCycle(run.id);

    await orderStarted;
    await orchestrator.stopRun(run.id, "Stop during order submission");
    resolveOrder({
      action: "buy",
      amountBase: 1,
      averagePrice: 100,
      feeUsd: 0,
      id: "racing-order",
      notionalUsd: 100,
      platform: "paper",
      requestedNotionalUsd: 100,
      status: "open",
      symbol: "BTC/USD",
      timestamp: new Date().toISOString(),
    });
    const stopped = await cycle;

    expect(stopped.status).toBe("stopped");
    expect(stopped.cycles).toHaveLength(0);
    expect(cancelCount).toBe(2);
  });

  it("cancels open orders before a finite run is marked completed", async () => {
    let cancelCount = 0;
    const provider: AiAgentProvider = {
      analyze: async () => ({
        confidence: 0.9,
        direction: "bullish",
        rationale: "Test",
        riskFlags: [],
        signals: ["Test"],
        summary: "Bullish test",
      }),
      report: async () => ({
        action: "Test",
        budgetSummary: "Test",
        headline: "Test",
        narrative: "Test",
        riskSummary: "Test",
      }),
      trade: async () => ({
        action: "buy",
        limitPrice: 100,
        notionalUsd: 100,
        orderType: "limit",
        reason: "Finite-run cancellation test",
      }),
    };
    const adapter: ExchangeAdapter = {
      cancelAllOrders: async () => {
        cancelCount += 1;
      },
      getAccount: async (symbol) => ({
        availableCashUsd: 1_000,
        equityUsd: 1_000,
        exposureUsd: 0,
        positionBase: 0,
        realizedPnlUsd: 0,
        symbol,
      }),
      getMarketSnapshot: async (symbol) => ({
        ask: 101,
        bid: 99,
        changePercent24h: 1,
        price: 100,
        symbol,
        timestamp: new Date().toISOString(),
        volume24h: 1_000,
      }),
      placeOrder: async (intent, symbol) => ({
        action: "buy",
        amountBase: intent.notionalUsd / 100,
        averagePrice: 100,
        feeUsd: 0,
        id: "finite-open-order",
        notionalUsd: intent.notionalUsd,
        platform: "paper",
        requestedNotionalUsd: intent.notionalUsd,
        status: "open",
        symbol,
        timestamp: new Date().toISOString(),
      }),
      platform: "paper",
      testConnection: async () => ({ message: "Test", ok: true }),
    };
    const orchestrator = new AgentOrchestrator(
      provider,
      { createForRun: () => adapter },
      { autoSchedule: false },
    );

    const run = await orchestrator.startRun(runConfig);
    const completed = await orchestrator.runOneCycle(run.id);

    expect(completed.status).toBe("completed");
    expect(cancelCount).toBe(1);
  });

  it("records a manual-cancellation warning instead of getting stuck stopping", async () => {
    const provider = new RoutedAiAgentProvider(new CredentialVault());
    const exchange = new PaperExchangeAdapter(
      runConfig.risk.capitalLimitUsd,
      new SyntheticMarketDataSource(100),
    );
    exchange.cancelAllOrders = async () => {
      throw new Error("venue unavailable");
    };
    const orchestrator = new AgentOrchestrator(
      provider,
      { createForRun: () => exchange },
      { autoSchedule: false },
    );
    const run = await orchestrator.startRun({ ...runConfig, maxCycles: 0 });

    const stopped = await orchestrator.stopRun(run.id);

    expect(stopped.status).toBe("failed");
    expect(stopped.lastError).toMatch(/manual exchange cancellation.*venue unavailable/i);
  });

  it("reports emergency-stop cancellation failures to the caller", async () => {
    const provider = new RoutedAiAgentProvider(new CredentialVault());
    const exchange = new PaperExchangeAdapter(
      runConfig.risk.capitalLimitUsd,
      new SyntheticMarketDataSource(100),
    );
    exchange.cancelAllOrders = async () => {
      throw new Error("venue unavailable");
    };
    const orchestrator = new AgentOrchestrator(
      provider,
      { createForRun: () => exchange },
      { autoSchedule: false },
    );
    const run = await orchestrator.startRun({ ...runConfig, maxCycles: 0 });

    const result = await orchestrator.emergencyStop();

    expect(result.cancellationFailures).toEqual([run.id]);
    expect(orchestrator.getRun(run.id)?.status).toBe("failed");
  });
});
