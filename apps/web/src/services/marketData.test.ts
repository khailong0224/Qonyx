import { describe, expect, it } from "vitest";
import {
  buildCoinbaseCandlesUrl,
  buildCoinbaseTickerUrl,
  parseCoinbaseCandles,
} from "./marketData";

describe("marketData", () => {
  it("parses, filters, and chronologically sorts Coinbase candles", () => {
    const candles = parseCoinbaseCandles([
      [2, 90, 110, 95, 105, 12],
      ["bad"],
      [1, 80, 100, 85, 95, 10],
    ]);

    expect(candles).toHaveLength(2);
    expect(candles.map((candle) => candle.time)).toEqual([1, 2]);
    expect(candles[0].close).toBe(95);
  });

  it("builds candle and ticker URLs for the selected product", () => {
    const candles = buildCoinbaseCandlesUrl({
      durationMs: 60_000,
      granularity: 60,
      product: "ETH-USD",
    });
    const ticker = buildCoinbaseTickerUrl("SOL-USD");

    expect(candles.pathname).toContain("/products/ETH-USD/candles");
    expect(candles.searchParams.get("granularity")).toBe("60");
    expect(ticker.pathname).toContain("/products/SOL-USD/ticker");
  });
});
