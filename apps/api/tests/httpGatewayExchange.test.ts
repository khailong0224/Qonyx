import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpGatewayExchangeAdapter } from "../src/exchanges/httpGatewayExchange.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpGatewayExchangeAdapter", () => {
  it("rejects malformed gateway account responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            availableCashUsd: 1_000,
            equityUsd: 1_000,
            exposureUsd: "not-a-number",
            positionBase: 0,
            realizedPnlUsd: 0,
            symbol: "US.AAPL",
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );
    const adapter = new HttpGatewayExchangeAdapter({
      baseUrl: "http://127.0.0.1:9000",
      platform: "moomoo",
      sandbox: true,
    });

    await expect(adapter.getAccount("US.AAPL")).rejects.toThrow(
      /invalid response.*exposureUsd/i,
    );
  });

  it("rejects gateway URLs that embed credentials", () => {
    expect(
      () =>
        new HttpGatewayExchangeAdapter({
          baseUrl: "https://user:password@gateway.example.test",
          platform: "webhook",
          sandbox: true,
        }),
    ).toThrow(/must not include credentials/i);
  });

  it("rejects an order response that exceeds the approved gross buy budget", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            action: "buy",
            amountBase: 2,
            averagePrice: 100,
            feeUsd: 1,
            id: "oversized-order",
            notionalUsd: 200,
            platform: "webhook",
            status: "filled",
            symbol: "BTC/USD",
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );
    const adapter = new HttpGatewayExchangeAdapter({
      baseUrl: "http://127.0.0.1:9000",
      platform: "webhook",
      sandbox: true,
    });

    await expect(
      adapter.placeOrder(
        {
          action: "buy",
          notionalUsd: 100,
          orderType: "market",
          reason: "Budget test",
        },
        "BTC/USD",
      ),
    ).rejects.toThrow(/exceeded the risk-approved gross buy budget/i);
  });
});
