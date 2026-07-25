import { describe, expect, it } from "vitest";
import type { AccountSnapshot, RiskLimits, TradeIntent } from "../src/domain.js";
import { evaluateRisk } from "../src/services/riskEngine.js";

const account: AccountSnapshot = {
  availableCashUsd: 1_000,
  equityUsd: 1_000,
  exposureUsd: 0,
  positionBase: 0,
  realizedPnlUsd: 0,
  symbol: "BTC/USD",
};

const limits: RiskLimits = {
  capitalLimitUsd: 1_000,
  dailyLossLimitUsd: 100,
  maxOrderUsd: 400,
  maxPositionPercent: 0.25,
};

const buy: TradeIntent = {
  action: "buy",
  notionalUsd: 5_000,
  orderType: "market",
  reason: "Agent requested an oversized trade.",
};

describe("evaluateRisk", () => {
  it("reduces an AI proposal to every configured fund boundary", () => {
    const decision = evaluateRisk(buy, account, limits, false);

    expect(decision.approved).toBe(true);
    expect(decision.intent.notionalUsd).toBe(250);
    expect(decision.violations).toContain(
      "Order was reduced to the configured maximum order size.",
    );
    expect(decision.violations).toContain(
      "Order was reduced to the maximum position allocation.",
    );
  });

  it("blocks all new orders while emergency stop is active", () => {
    const decision = evaluateRisk(buy, account, limits, true);

    expect(decision.approved).toBe(false);
    expect(decision.intent.action).toBe("hold");
    expect(decision.intent.notionalUsd).toBe(0);
  });

  it("blocks selling more than the funded long position", () => {
    const decision = evaluateRisk(
      { ...buy, action: "sell", notionalUsd: 500 },
      account,
      limits,
      false,
    );

    expect(decision.approved).toBe(false);
    expect(decision.intent.action).toBe("hold");
  });

  it("blocks trading after the daily loss limit is reached", () => {
    const decision = evaluateRisk(
      buy,
      { ...account, realizedPnlUsd: -100 },
      limits,
      false,
    );

    expect(decision.approved).toBe(false);
    expect(decision.violations[0]).toMatch(/daily loss/i);
  });
});
