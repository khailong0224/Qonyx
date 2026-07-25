import { z } from "zod";

const agentRoleSchema = z.enum(["analyst", "trader", "reporter"]);
const cryptoPairSchema = /^[A-Z0-9]{2,15}\/[A-Z0-9]{2,15}$/;
const gatewaySymbolSchema = /^[A-Z0-9][A-Z0-9._:/-]{0,39}$/;

function hasNoUrlCredentials(value: string) {
  try {
    const url = new URL(value);
    return !url.username && !url.password;
  } catch {
    return false;
  }
}

const safeUrlSchema = z
  .string()
  .trim()
  .url()
  .max(300)
  .refine(hasNoUrlCredentials, "URLs must not include a username or password");

const agentConfigSchema = z.object({
  connectionId: z.string().uuid().optional(),
  instructions: z.string().trim().max(2_000).optional(),
  model: z.string().trim().max(120).optional(),
  name: z.string().trim().min(1).max(80),
  role: agentRoleSchema,
});

export const createRunSchema = z
  .object({
    agents: z.object({
      analyst: agentConfigSchema.extend({ role: z.literal("analyst") }),
      reporter: agentConfigSchema.extend({ role: z.literal("reporter") }),
      trader: agentConfigSchema.extend({ role: z.literal("trader") }),
    }),
    cycleIntervalMs: z.number().int().min(5_000).max(3_600_000).default(30_000),
    exchangeConnectionId: z.string().uuid().optional(),
    maxCycles: z.number().int().min(0).max(10_000).default(0),
    mode: z.enum(["paper", "live"]).default("paper"),
    name: z.string().trim().min(1).max(100),
    platform: z
      .enum(["paper", "binance", "bitget", "bybit", "moomoo", "webhook"])
      .default("paper"),
    risk: z.object({
      capitalLimitUsd: z.number().positive().max(100_000_000),
      dailyLossLimitUsd: z.number().positive().max(100_000_000),
      maxOrderUsd: z.number().positive().max(100_000_000),
      maxPositionPercent: z.number().min(0.01).max(1),
    }),
    symbol: z.string().trim().min(1).max(40),
  })
  .superRefine((value, context) => {
    if (value.risk.maxOrderUsd > value.risk.capitalLimitUsd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxOrderUsd cannot exceed capitalLimitUsd",
        path: ["risk", "maxOrderUsd"],
      });
    }

    if (value.mode === "live" && value.platform === "paper") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Live mode requires a configured exchange platform",
        path: ["platform"],
      });
    }

    if (value.mode === "live" && !value.exchangeConnectionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Live mode requires an exchange connection",
        path: ["exchangeConnectionId"],
      });
    }

    const symbolPattern =
      value.platform === "moomoo" || value.platform === "webhook"
        ? gatewaySymbolSchema
        : cryptoPairSchema;
    if (!symbolPattern.test(value.symbol)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          value.platform === "moomoo" || value.platform === "webhook"
            ? "Use an uppercase venue symbol such as US.AAPL or BTC/USD"
            : "Use an uppercase market pair such as BTC/USD",
        path: ["symbol"],
      });
    }
  });

export const aiConnectionSchema = z.object({
  apiKey: z.string().trim().min(8).max(500).optional(),
  baseUrl: safeUrlSchema.optional(),
  label: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  provider: z.enum(["sandbox", "openai-compatible", "ollama"]),
});

export const exchangeConnectionSchema = z.object({
  apiKey: z.string().trim().min(3).max(500).optional(),
  baseUrl: safeUrlSchema.optional(),
  label: z.string().trim().min(1).max(80),
  passphrase: z.string().max(500).optional(),
  platform: z.enum(["paper", "binance", "bitget", "bybit", "moomoo", "webhook"]),
  sandbox: z.boolean().default(true),
  secret: z.string().max(500).optional(),
});

export const analysisSchema = z.object({
  confidence: z.number().min(0).max(1),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  rationale: z.string().min(1).max(2_000),
  riskFlags: z.array(z.string().max(200)).max(12),
  signals: z.array(z.string().max(200)).max(12),
  summary: z.string().min(1).max(500),
});

export const tradeIntentSchema = z
  .object({
    action: z.enum(["buy", "sell", "hold"]),
    limitPrice: z.number().positive().optional(),
    notionalUsd: z.number().min(0).max(100_000_000),
    orderType: z.enum(["market", "limit"]),
    reason: z.string().min(1).max(1_000),
  })
  .superRefine((value, context) => {
    if (value.action === "hold" && value.notionalUsd !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hold intents must use zero notional",
        path: ["notionalUsd"],
      });
    }
    if (value.orderType === "limit" && value.limitPrice === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Limit orders require limitPrice",
        path: ["limitPrice"],
      });
    }
    if (value.orderType === "market" && value.limitPrice !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Market orders must not include limitPrice",
        path: ["limitPrice"],
      });
    }
  });

export const tradingReportSchema = z.object({
  action: z.string().min(1).max(300),
  budgetSummary: z.string().min(1).max(500),
  headline: z.string().min(1).max(200),
  narrative: z.string().min(1).max(2_000),
  riskSummary: z.string().min(1).max(500),
});
