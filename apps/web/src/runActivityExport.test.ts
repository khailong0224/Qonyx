import { describe, expect, it } from "vitest";
import {
  buildRunActivityExport,
  runActivityFileName,
} from "./runActivityExport";
import type { AgentRun } from "./services/qonyxApi";

describe("runtime activity export", () => {
  it("builds a safe, portable run summary and filename", () => {
    const run = {
      config: {
        agents: {
          analyst: { connectionId: "ai-connection", name: "Atlas", role: "analyst" },
          reporter: { name: "Ledger", role: "reporter" },
          trader: { name: "Vector", role: "trader" },
        },
        cycleIntervalMs: 5_000,
        exchangeConnectionId: "exchange-connection",
        maxCycles: 1,
        mode: "paper",
        name: "BTC/USD three-agent run",
        platform: "paper",
        risk: {
          capitalLimitUsd: 1_000,
          dailyLossLimitUsd: 100,
          maxOrderUsd: 100,
          maxPositionPercent: 0.25,
        },
        symbol: "BTC/USD",
      },
      createdAt: "2026-07-25T00:00:00.000Z",
      cycles: [],
      events: [
        {
          category: "run",
          id: "event-1",
          level: "info",
          message: "Run started in paper mode.",
          timestamp: "2026-07-25T00:00:00.000Z",
        },
      ],
      id: "run-1",
      status: "running",
      updatedAt: "2026-07-25T00:00:00.000Z",
    } satisfies AgentRun;

    const result = buildRunActivityExport(run, "2026-07-25T00:01:00.000Z");

    expect(result).toEqual({
      events: run.events,
      exportedAt: "2026-07-25T00:01:00.000Z",
      run: {
        id: "run-1",
        mode: "paper",
        name: "BTC/USD three-agent run",
        platform: "paper",
        status: "running",
        symbol: "BTC/USD",
      },
    });
    expect(JSON.stringify(result)).not.toContain("exchange-connection");
    expect(JSON.stringify(result)).not.toContain("ai-connection");
    expect(runActivityFileName(run.config.name)).toBe(
      "btc-usd-three-agent-run-activity.json",
    );
  });
});
