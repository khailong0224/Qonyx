import { randomUUID } from "node:crypto";
import * as ccxt from "ccxt";
import type {
  AccountSnapshot,
  ExchangeAdapter,
  ExchangeConnectionSecret,
  ExchangePlatform,
  MarketSnapshot,
  OrderResult,
  TradeIntent,
} from "../domain.js";

type SupportedCcxtPlatform = Extract<ExchangePlatform, "binance" | "bitget" | "bybit">;
type ExchangeConstructor = new (options?: Record<string, unknown>) => ccxt.Exchange;

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export class CcxtExchangeAdapter implements ExchangeAdapter {
  readonly platform: SupportedCcxtPlatform;
  readonly #exchange: ccxt.Exchange;

  constructor(secret: ExchangeConnectionSecret & { platform: SupportedCcxtPlatform }) {
    this.platform = secret.platform;
    const Constructor = (ccxt as unknown as Record<string, ExchangeConstructor>)[secret.platform];
    if (!Constructor) {
      throw new Error(`CCXT does not provide the ${secret.platform} exchange.`);
    }

    this.#exchange = new Constructor({
      apiKey: secret.apiKey,
      enableRateLimit: true,
      password: secret.passphrase,
      secret: secret.secret,
    });
    if (secret.sandbox) {
      this.#exchange.setSandboxMode(true);
    }
  }

  async cancelAllOrders(symbol: string) {
    if (this.#exchange.has.cancelAllOrders) {
      await this.#exchange.cancelAllOrders(symbol);
      return;
    }

    if (!this.#exchange.has.fetchOpenOrders) {
      return;
    }

    const orders = await this.#exchange.fetchOpenOrders(symbol);
    await Promise.allSettled(
      orders
        .filter((order): order is typeof order & { id: string } => Boolean(order.id))
        .map((order) => this.#exchange.cancelOrder(order.id, symbol)),
    );
  }

  async getAccount(symbol: string): Promise<AccountSnapshot> {
    const [base, quote] = symbol.split("/");
    const [balance, market] = await Promise.all([
      this.#exchange.fetchBalance(),
      this.getMarketSnapshot(symbol),
    ]);
    const free = (balance.free ?? {}) as unknown as Record<string, number | undefined>;
    const total = (balance.total ?? {}) as unknown as Record<string, number | undefined>;
    const availableCashUsd = numberOrZero(free[quote]);
    const quoteTotal = numberOrZero(total[quote]);
    const positionBase = numberOrZero(total[base]);
    const exposureUsd = positionBase * market.price;

    return {
      availableCashUsd,
      equityUsd: quoteTotal + exposureUsd,
      exposureUsd,
      positionBase,
      realizedPnlUsd: 0,
      symbol,
    };
  }

  async getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
    const ticker = await this.#exchange.fetchTicker(symbol);
    const price = numberOrZero(ticker.last) || numberOrZero(ticker.close);
    if (price <= 0) {
      throw new Error(`${this.platform} returned an invalid ${symbol} price.`);
    }

    return {
      ask: numberOrZero(ticker.ask) || price,
      bid: numberOrZero(ticker.bid) || price,
      changePercent24h: numberOrZero(ticker.percentage),
      price,
      symbol,
      timestamp: ticker.datetime || new Date().toISOString(),
      volume24h: numberOrZero(ticker.baseVolume),
    };
  }

  async placeOrder(intent: TradeIntent, symbol: string): Promise<OrderResult> {
    if (intent.action === "hold") {
      throw new Error("A hold decision cannot be submitted as an order.");
    }

    await this.#exchange.loadMarkets();
    const market = await this.getMarketSnapshot(symbol);
    const referencePrice = intent.limitPrice || market.price;
    const rawAmount = intent.notionalUsd / referencePrice;
    const amount = Number(this.#exchange.amountToPrecision(symbol, rawAmount));
    const price =
      intent.orderType === "limit" && intent.limitPrice
        ? Number(this.#exchange.priceToPrecision(symbol, intent.limitPrice))
        : undefined;
    const order = await this.#exchange.createOrder(
      symbol,
      intent.orderType,
      intent.action,
      amount,
      price,
    );
    const averagePrice = numberOrZero(order.average) || numberOrZero(order.price) || referencePrice;
    const filled = numberOrZero(order.filled) || amount;
    const feeUsd = numberOrZero(order.fee?.cost);

    return {
      action: intent.action,
      amountBase: filled,
      averagePrice,
      feeUsd,
      id: order.id || randomUUID(),
      notionalUsd: filled * averagePrice,
      platform: this.platform,
      status:
        order.status === "closed"
          ? "filled"
          : order.status === "canceled"
            ? "cancelled"
            : order.status === "rejected"
              ? "rejected"
              : "open",
      symbol,
      timestamp: order.datetime || new Date().toISOString(),
    };
  }

  async testConnection() {
    await this.#exchange.loadMarkets();
    await this.#exchange.fetchBalance();
    return {
      message: `${this.platform} ${this.#exchange.isSandboxModeEnabled ? "sandbox" : "account"} connected.`,
      ok: true,
    };
  }
}
