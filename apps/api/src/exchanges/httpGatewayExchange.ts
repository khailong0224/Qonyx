import type {
  AccountSnapshot,
  ExchangeAdapter,
  ExchangeConnectionSecret,
  MarketSnapshot,
  OrderResult,
  TradeIntent,
} from "../domain.js";

function safeGatewayUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    throw new Error("This exchange requires a gateway base URL.");
  }

  const url = new URL(rawUrl);
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

  async #request<T>(path: string, init?: RequestInit): Promise<T> {
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
    return (await response.json()) as T;
  }

  async cancelAllOrders(symbol: string) {
    await this.#request(`/orders?symbol=${encodeURIComponent(symbol)}`, {
      method: "DELETE",
    });
  }

  async getAccount(symbol: string) {
    return this.#request<AccountSnapshot>(`/account?symbol=${encodeURIComponent(symbol)}`);
  }

  async getMarketSnapshot(symbol: string) {
    return this.#request<MarketSnapshot>(`/market?symbol=${encodeURIComponent(symbol)}`);
  }

  async placeOrder(intent: TradeIntent, symbol: string) {
    return this.#request<OrderResult>("/orders", {
      body: JSON.stringify({ intent, symbol }),
      method: "POST",
    });
  }

  async testConnection() {
    return this.#request<{ message: string; ok: boolean }>("/health");
  }
}
