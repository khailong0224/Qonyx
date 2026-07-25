import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  AgentRunConfig,
  AiAgentProvider,
  ExchangeAdapter,
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
    expect(orchestrator.getRun(run.id)?.status).toBe("stopped");
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
});
