import type {
  AccountSnapshot,
  ExchangeAdapter,
  MarketSnapshot,
  OrderResult,
  TradeIntent,
} from "../domain.js";

/**
 * Keeps the capital and positions owned by one agent run separate from the
 * operator's wider exchange account. The underlying adapter still verifies
 * credentials and submits orders, but the risk engine only sees this ledger.
 */
export class FundCappedExchangeAdapter implements ExchangeAdapter {
  readonly platform;
  readonly #delegate: ExchangeAdapter;
  #averageEntryPrice = 0;
  #cashUsd: number;
  #lastMarket?: MarketSnapshot;
  #positionBase = 0;
  #realizedPnlUsd = 0;

  constructor(delegate: ExchangeAdapter, capitalLimitUsd: number) {
    this.#delegate = delegate;
    this.#cashUsd = capitalLimitUsd;
    this.platform = delegate.platform;
  }

  async cancelAllOrders(symbol: string) {
    await this.#delegate.cancelAllOrders(symbol);
  }

  async getAccount(symbol: string): Promise<AccountSnapshot> {
    const market =
      this.#lastMarket?.symbol === symbol
        ? this.#lastMarket
        : await this.getMarketSnapshot(symbol);
    const exposureUsd = this.#positionBase * market.price;

    return {
      availableCashUsd: this.#cashUsd,
      equityUsd: this.#cashUsd + exposureUsd,
      exposureUsd,
      positionBase: this.#positionBase,
      realizedPnlUsd: this.#realizedPnlUsd,
      symbol,
    };
  }

  async getMarketSnapshot(symbol: string, signal?: AbortSignal) {
    const market = await this.#delegate.getMarketSnapshot(symbol, signal);
    this.#lastMarket = market;
    return market;
  }

  async placeOrder(intent: TradeIntent, symbol: string): Promise<OrderResult> {
    if (intent.action === "hold") {
      throw new Error("A hold decision cannot be submitted as an order.");
    }

    const market = await this.getMarketSnapshot(symbol);
    const referencePrice =
      intent.limitPrice ||
      (intent.action === "buy" ? market.ask : market.bid) ||
      market.price;
    const maximumNotional =
      intent.action === "buy"
        ? this.#cashUsd
        : this.#positionBase * referencePrice;
    const cappedIntent = {
      ...intent,
      notionalUsd: Math.min(intent.notionalUsd, Math.max(0, maximumNotional)),
    };

    if (cappedIntent.notionalUsd <= 0) {
      throw new Error(
        intent.action === "buy"
          ? "The run has no funded cash remaining."
          : "The run has no agent-owned position to sell.",
      );
    }

    const order = await this.#delegate.placeOrder(cappedIntent, symbol);
    this.#recordExecution(order);
    return order;
  }

  async testConnection() {
    return this.#delegate.testConnection();
  }

  #recordExecution(order: OrderResult) {
    if (order.amountBase <= 0 || order.notionalUsd <= 0) {
      return;
    }

    if (order.action === "buy") {
      const existingCost = this.#positionBase * this.#averageEntryPrice;
      const totalCost = Math.min(
        this.#cashUsd,
        order.notionalUsd + Math.max(0, order.feeUsd),
      );
      const assetCost = Math.min(order.notionalUsd, totalCost);

      this.#cashUsd = Math.max(0, this.#cashUsd - totalCost);
      this.#positionBase += order.amountBase;
      this.#averageEntryPrice =
        this.#positionBase > 0
          ? (existingCost + assetCost) / this.#positionBase
          : 0;
      return;
    }

    const amountBase = Math.min(this.#positionBase, order.amountBase);
    const fillRatio = order.amountBase > 0 ? amountBase / order.amountBase : 0;
    const notionalUsd = order.notionalUsd * fillRatio;
    const feeUsd = Math.max(0, order.feeUsd) * fillRatio;

    this.#cashUsd += Math.max(0, notionalUsd - feeUsd);
    this.#positionBase -= amountBase;
    this.#realizedPnlUsd +=
      notionalUsd - this.#averageEntryPrice * amountBase - feeUsd;
    if (this.#positionBase <= 1e-10) {
      this.#positionBase = 0;
      this.#averageEntryPrice = 0;
    }
  }
}
