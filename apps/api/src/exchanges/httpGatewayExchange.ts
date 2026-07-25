import type {
  AccountSnapshot,
  ExchangeAdapter,
  ExchangeConnectionSecret,
  MarketSnapshot,
  OrderResult,
  TradeIntent,
} from "../domain.js";
import { z, type ZodType } from "zod";

const accountSnapshotSchema = z.object({
  availableCashUsd: z.number().nonnegative(),
  equityUsd: z.number(),
  exposureUsd: z.number().nonnegative(),
  positionBase: z.number().nonnegative(),
  realizedPnlUsd: z.number(),
  symbol: z.string().min(1),
});

const marketSnapshotSchema = z.object({
  ask: z.number().positive(),
  bid: z.number().positive(),
  changePercent24h: z.number(),
  price: z.number().positive(),
  symbol: z.string().min(1),
  timestamp: z.string().datetime(),
  volume24h: z.number().nonnegative(),
});

const orderResultSchema = z.object({
  action: z.enum(["buy", "sell"]),
  amountBase: z.number().nonnegative(),
  averagePrice: z.number().nonnegative(),
  feeUsd: z.number().nonnegative(),
  id: z.string().min(1),
  notionalUsd: z.number().nonnegative(),
  platform: z.enum(["paper", "binance", "bitget", "bybit", "moomoo", "webhook"]),
  requestedNotionalUsd: z.number().nonnegative().optional(),
  status: z.enum(["filled", "open", "cancelled", "rejected"]),
  symbol: z.string().min(1),
  timestamp: z.string().datetime(),
});

const healthSchema = z.object({
  message: z.string().min(1),
  ok: z.boolean(),
});

function safeGatewayUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    throw new Error("This exchange requires a gateway base URL.");
  }

  const url = new URL(rawUrl);
  if (url.username || url.password) {
    throw new Error("Exchange gateway URLs must not include credentials.");
  }
  const localHost = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(localHost && url.protocol === "http:")) {
    throw new Error("Exchange gateway URLs must use HTTPS, except on the local machine.");
  }
  return url.toString().replace(/\/$/, "");
}

export class HttpGatewayExchangeAdapter implements ExchangeAdapter {
  readonly platform: "moomoo" | "webhook";
  readonly #baseUrl: string;
  readonly #headers: Record<string, string>;

  constructor(
    secret: ExchangeConnectionSecret & { platform: "moomoo" | "webhook" },
  ) {
    this.platform = secret.platform;
    this.#baseUrl = safeGatewayUrl(secret.baseUrl);
    this.#headers = {
      ...(secret.apiKey ? { Authorization: `Bearer ${secret.apiKey}` } : {}),
      "Content-Type": "application/json",
    };
  }

  async #request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: { ...this.#headers, ...init?.headers },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `${this.platform} gateway returned HTTP ${response.status}: ${body.slice(0, 240)}`,
      );
    }
    let payload: unknown;
    try {
      payload = response.status === 204 ? undefined : await response.json();
    } catch {
      throw new Error(`${this.platform} gateway returned invalid JSON for ${path}.`);
    }
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new Error(
        `${this.platform} gateway returned an invalid response for ${path}: ${result.error.issues
          .map((issue) => `${issue.path.join(".") || "response"} ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.data;
  }

  async cancelAllOrders(symbol: string) {
    await this.#request(
      `/orders?symbol=${encodeURIComponent(symbol)}`,
      z.unknown(),
      { method: "DELETE" },
    );
  }

  async getAccount(symbol: string) {
    return this.#request<AccountSnapshot>(
      `/account?symbol=${encodeURIComponent(symbol)}`,
      accountSnapshotSchema,
    );
  }

  async getMarketSnapshot(symbol: string) {
    return this.#request<MarketSnapshot>(
      `/market?symbol=${encodeURIComponent(symbol)}`,
      marketSnapshotSchema,
    );
  }

  async placeOrder(intent: TradeIntent, symbol: string) {
    const order = await this.#request<OrderResult>(
      "/orders",
      orderResultSchema,
      {
        body: JSON.stringify({ intent, symbol }),
        method: "POST",
      },
    );
    if (
      order.action !== intent.action ||
      order.platform !== this.platform ||
      order.symbol !== symbol
    ) {
      throw new Error(
        `${this.platform} gateway returned an order for the wrong action, platform, or symbol.`,
      );
    }
    if (
      intent.action === "buy" &&
      order.notionalUsd + order.feeUsd > intent.notionalUsd + 0.01
    ) {
      throw new Error(
        `${this.platform} gateway exceeded the risk-approved gross buy budget.`,
      );
    }
    return order;
  }

  async testConnection() {
    return this.#request("/health", healthSchema);
  }
}
