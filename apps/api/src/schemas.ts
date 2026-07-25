import { z } from "zod";

const agentRoleSchema = z.enum(["analyst", "trader", "reporter"]);

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
    symbol: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{2,15}\/[A-Z0-9]{2,15}$/),
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
  });

export const aiConnectionSchema = z.object({
  apiKey: z.string().trim().min(8).max(500).optional(),
  baseUrl: z.string().trim().url().max(300).optional(),
  label: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  provider: z.enum(["sandbox", "openai-compatible", "ollama"]),
});

export const exchangeConnectionSchema = z.object({
  apiKey: z.string().trim().min(3).max(500).optional(),
  baseUrl: z.string().trim().url().max(300).optional(),
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

export const tradeIntentSchema = z.object({
  action: z.enum(["buy", "sell", "hold"]),
  limitPrice: z.number().positive().optional(),
  notionalUsd: z.number().min(0).max(100_000_000),
  orderType: z.enum(["market", "limit"]),
  reason: z.string().min(1).max(1_000),
});

export const tradingReportSchema = z.object({
  action: z.string().min(1).max(300),
  budgetSummary: z.string().min(1).max(500),
  headline: z.string().min(1).max(200),
  narrative: z.string().min(1).max(2_000),
  riskSummary: z.string().min(1).max(500),
});
