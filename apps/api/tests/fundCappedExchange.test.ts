import { describe, expect, it } from "vitest";
import type {
  ExchangeAdapter,
  OrderResult,
  TradeIntent,
} from "../src/domain.js";
import { FundCappedExchangeAdapter } from "../src/exchanges/fundCappedExchange.js";

function buildDelegate() {
  const submitted: TradeIntent[] = [];
  const delegate: ExchangeAdapter = {
    cancelAllOrders: async () => undefined,
    getAccount: async (symbol) => ({
      availableCashUsd: 50_000,
      equityUsd: 100_000,
      exposureUsd: 50_000,
      positionBase: 500,
      realizedPnlUsd: 10_000,
      symbol,
    }),
    getMarketSnapshot: async (symbol) => ({
      ask: 100,
      bid: 100,
      changePercent24h: 1,
      price: 100,
      symbol,
      timestamp: new Date().toISOString(),
      volume24h: 1_000,
    }),
    placeOrder: async (intent, symbol) => {
      submitted.push(intent);
      const result: OrderResult = {
        action: intent.action === "sell" ? "sell" : "buy",
        amountBase: intent.notionalUsd / 100,
        averagePrice: 100,
        feeUsd: 1,
        id: `order-${submitted.length}`,
        notionalUsd: intent.notionalUsd,
        platform: "binance",
        requestedNotionalUsd: intent.notionalUsd,
        status: "filled",
        symbol,
        timestamp: new Date().toISOString(),
      };
      return result;
    },
    platform: "binance",
    testConnection: async () => ({ message: "Connected", ok: true }),
  };

  return { delegate, submitted };
}

describe("FundCappedExchangeAdapter", () => {
  it("hides unrelated exchange cash and positions from the agent run", async () => {
    const { delegate, submitted } = buildDelegate();
    const exchange = new FundCappedExchangeAdapter(delegate, 1_000);
    const account = await exchange.getAccount("BTC/USD");

    expect(account).toMatchObject({
      availableCashUsd: 1_000,
      exposureUsd: 0,
      positionBase: 0,
      realizedPnlUsd: 0,
    });
    await expect(
      exchange.placeOrder(
        {
          action: "sell",
          notionalUsd: 100,
          orderType: "market",
          reason: "Must not sell an external holding",
        },
        "BTC/USD",
      ),
    ).rejects.toThrow(/agent-owned position/i);
    expect(submitted).toHaveLength(0);
  });

  it("tracks only fills funded and owned by this run", async () => {
    const { delegate, submitted } = buildDelegate();
    const exchange = new FundCappedExchangeAdapter(delegate, 1_000);

    await exchange.placeOrder(
      {
        action: "buy",
        notionalUsd: 200,
        orderType: "market",
        reason: "Funded entry",
      },
      "BTC/USD",
    );
    const afterBuy = await exchange.getAccount("BTC/USD");

    expect(afterBuy.availableCashUsd).toBe(799);
    expect(afterBuy.positionBase).toBe(2);
    expect(afterBuy.exposureUsd).toBe(200);

    await exchange.placeOrder(
      {
        action: "sell",
        notionalUsd: 5_000,
        orderType: "market",
        reason: "Oversized exit",
      },
      "BTC/USD",
    );
    const afterSell = await exchange.getAccount("BTC/USD");

    expect(submitted[1].notionalUsd).toBe(200);
    expect(afterSell.positionBase).toBe(0);
    expect(afterSell.availableCashUsd).toBe(998);
    expect(afterSell.realizedPnlUsd).toBe(-1);
  });
});
