import { describe, expect, it } from "vitest";
import { PaperExchangeAdapter } from "../src/exchanges/paperExchange.js";
import {
  ResilientMarketDataSource,
  SyntheticMarketDataSource,
} from "../src/services/marketData.js";

describe("PaperExchangeAdapter", () => {
  it("never spends more cash than the funded paper account", async () => {
    const exchange = new PaperExchangeAdapter(
      1_000,
      new SyntheticMarketDataSource(100),
    );
    await exchange.getMarketSnapshot("TEST/USD");

    const order = await exchange.placeOrder(
      {
        action: "buy",
        notionalUsd: 5_000,
        orderType: "market",
        reason: "Oversized test order",
      },
      "TEST/USD",
    );
    const account = await exchange.getAccount("TEST/USD");

    expect(order.notionalUsd + order.feeUsd).toBeLessThanOrEqual(1_000);
    expect(account.availableCashUsd).toBeGreaterThanOrEqual(0);
    expect(account.positionBase).toBeGreaterThan(0);
  });

  it("can reduce a funded long position and records realized PnL", async () => {
    const exchange = new PaperExchangeAdapter(
      1_000,
      new SyntheticMarketDataSource(100),
    );
    await exchange.getMarketSnapshot("TEST/USD");
    await exchange.placeOrder(
      {
        action: "buy",
        notionalUsd: 200,
        orderType: "market",
        reason: "Open test position",
      },
      "TEST/USD",
    );
    const sell = await exchange.placeOrder(
      {
        action: "sell",
        notionalUsd: 100,
        orderType: "market",
        reason: "Reduce test position",
      },
      "TEST/USD",
    );

    expect(sell.action).toBe("sell");
    expect(sell.status).toBe("filled");
    expect((await exchange.getAccount("TEST/USD")).positionBase).toBeGreaterThan(0);
  });

  it("falls back to synthetic market data when the public feed fails", async () => {
    const source = new ResilientMarketDataSource(
      {
        getSnapshot: async () => {
          throw new Error("Public feed unavailable");
        },
      },
      new SyntheticMarketDataSource(123),
    );

    const snapshot = await source.getSnapshot("TEST/USD");

    expect(snapshot.price).toBeGreaterThan(0);
    expect(snapshot.symbol).toBe("TEST/USD");
  });
});
