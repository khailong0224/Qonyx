import type {
  AccountSnapshot,
  RiskDecision,
  RiskLimits,
  TradeIntent,
} from "../domain.js";

const MIN_ORDER_USD = 5;

function holdIntent(reason: string): TradeIntent {
  return {
    action: "hold",
    notionalUsd: 0,
    orderType: "market",
    reason,
  };
}

export function evaluateRisk(
  intent: TradeIntent,
  account: AccountSnapshot,
  limits: RiskLimits,
  globallyHalted: boolean,
): RiskDecision {
  const remainingBudgetUsd = Math.max(0, limits.capitalLimitUsd - account.exposureUsd);

  if (globallyHalted) {
    return {
      approved: false,
      intent: holdIntent("Qonyx emergency stop is active."),
      remainingBudgetUsd,
      violations: ["Emergency stop blocks all new orders."],
    };
  }

  if (account.realizedPnlUsd <= -limits.dailyLossLimitUsd) {
    return {
      approved: false,
      intent: holdIntent("Daily loss limit reached."),
      remainingBudgetUsd,
      violations: ["The configured daily loss limit has been reached."],
    };
  }

  if (intent.action === "hold") {
    return {
      approved: true,
      intent: { ...intent, notionalUsd: 0 },
      remainingBudgetUsd,
      violations: [],
    };
  }

  const requested = Math.max(0, intent.notionalUsd);

  if (intent.action === "sell") {
    const allowed = Math.min(requested, account.exposureUsd);
    if (allowed < MIN_ORDER_USD) {
      return {
        approved: false,
        intent: holdIntent("No funded long position is available to sell."),
        remainingBudgetUsd,
        violations: ["Sell amount exceeds the current long exposure."],
      };
    }

    return {
      approved: true,
      intent: { ...intent, notionalUsd: allowed },
      remainingBudgetUsd,
      violations:
        allowed < requested
          ? ["Sell order was reduced to the current funded position."]
          : [],
    };
  }

  const positionCapUsd = limits.capitalLimitUsd * limits.maxPositionPercent;
  const remainingPositionCapacity = Math.max(0, positionCapUsd - account.exposureUsd);
  const allowed = Math.min(
    requested,
    limits.maxOrderUsd,
    remainingBudgetUsd,
    remainingPositionCapacity,
    account.availableCashUsd * 0.998,
  );
  const violations: string[] = [];

  if (requested > limits.maxOrderUsd) {
    violations.push("Order was reduced to the configured maximum order size.");
  }
  if (requested > remainingBudgetUsd) {
    violations.push("Order was reduced to the remaining agent fund.");
  }
  if (requested > remainingPositionCapacity) {
    violations.push("Order was reduced to the maximum position allocation.");
  }
  if (requested > account.availableCashUsd) {
    violations.push("Order was reduced to available cash.");
  }

  if (allowed < MIN_ORDER_USD) {
    return {
      approved: false,
      intent: holdIntent("No risk-approved buying capacity remains."),
      remainingBudgetUsd,
      violations: violations.length > 0 ? violations : ["Order is below the minimum paper size."],
    };
  }

  return {
    approved: true,
    intent: { ...intent, notionalUsd: allowed },
    remainingBudgetUsd,
    violations,
  };
}
