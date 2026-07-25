import { randomUUID } from "node:crypto";
import type {
  AccountSnapshot,
  ExchangeAdapter,
  MarketSnapshot,
  OrderResult,
  TradeIntent,
} from "../domain.js";
import type { MarketDataSource } from "../services/marketData.js";
import { ResilientMarketDataSource } from "../services/marketData.js";

const PAPER_FEE_RATE = 0.001;

export class PaperExchangeAdapter implements ExchangeAdapter {
  readonly platform = "paper" as const;
  readonly #marketData: MarketDataSource;
  #averageEntryPrice = 0;
  #cashUsd: number;
  #lastPrice = 0;
  #positionBase = 0;
  #realizedPnlUsd = 0;

  constructor(
    initialCapitalUsd: number,
    marketData: MarketDataSource = new ResilientMarketDataSource(),
  ) {
    this.#cashUsd = initialCapitalUsd;
    this.#marketData = marketData;
  }

  async cancelAllOrders() {
    // Paper orders are filled synchronously, so there are no resting orders to cancel.
  }

  async getAccount(symbol: string): Promise<AccountSnapshot> {
    const positionValue = this.#positionBase * this.#lastPrice;
    return {
      availableCashUsd: this.#cashUsd,
      equityUsd: this.#cashUsd + positionValue,
      exposureUsd: positionValue,
      positionBase: this.#positionBase,
      realizedPnlUsd: this.#realizedPnlUsd,
      symbol,
    };
  }

  async getMarketSnapshot(symbol: string, signal?: AbortSignal): Promise<MarketSnapshot> {
    const snapshot = await this.#marketData.getSnapshot(symbol, signal);
    this.#lastPrice = snapshot.price;
    return snapshot;
  }

  async placeOrder(intent: TradeIntent, symbol: string): Promise<OrderResult> {
    if (intent.action === "hold") {
      throw new Error("A hold decision cannot be submitted as an order.");
    }

    const market = await this.getMarketSnapshot(symbol);
    const price =
      intent.orderType === "limit" && intent.limitPrice
        ? intent.limitPrice
        : intent.action === "buy"
          ? market.ask
          : market.bid;

    if (intent.action === "buy") {
      const affordableNotional =
        Math.floor((Math.max(0, this.#cashUsd) / (1 + PAPER_FEE_RATE)) * 100_000_000) /
        100_000_000;
      const notionalUsd = Math.min(intent.notionalUsd, affordableNotional);
      const amountBase = notionalUsd / price;
      const feeUsd = Math.min(
        notionalUsd * PAPER_FEE_RATE,
        Math.max(0, this.#cashUsd - notionalUsd),
      );
      const existingCost = this.#positionBase * this.#averageEntryPrice;

      this.#cashUsd = Math.max(0, this.#cashUsd - notionalUsd - feeUsd);
      this.#positionBase += amountBase;
      this.#averageEntryPrice =
        this.#positionBase > 0 ? (existingCost + notionalUsd) / this.#positionBase : 0;

      return {
        action: "buy",
        amountBase,
        averagePrice: price,
        feeUsd,
        id: randomUUID(),
        notionalUsd,
        platform: this.platform,
        status: "filled",
        symbol,
        timestamp: new Date().toISOString(),
      };
    }

    const amountBase = Math.min(this.#positionBase, intent.notionalUsd / price);
    const notionalUsd = amountBase * price;
    const feeUsd = notionalUsd * PAPER_FEE_RATE;
    this.#cashUsd += notionalUsd - feeUsd;
    this.#positionBase -= amountBase;
    this.#realizedPnlUsd += (price - this.#averageEntryPrice) * amountBase - feeUsd;
    if (this.#positionBase <= 1e-10) {
      this.#positionBase = 0;
      this.#averageEntryPrice = 0;
    }

    return {
      action: "sell",
      amountBase,
      averagePrice: price,
      feeUsd,
      id: randomUUID(),
      notionalUsd,
      platform: this.platform,
      status: "filled",
      symbol,
      timestamp: new Date().toISOString(),
    };
  }

  async testConnection() {
    return { message: "Local paper exchange is ready.", ok: true };
  }
}
