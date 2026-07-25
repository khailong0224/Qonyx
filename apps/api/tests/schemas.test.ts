import { describe, expect, it } from "vitest";
import { tradeIntentSchema } from "../src/schemas.js";

describe("tradeIntentSchema", () => {
  it("requires a price for limit orders", () => {
    const result = tradeIntentSchema.safeParse({
      action: "buy",
      notionalUsd: 100,
      orderType: "limit",
      reason: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["limitPrice"]);
  });

  it("requires hold intents to have zero notional", () => {
    const result = tradeIntentSchema.safeParse({
      action: "hold",
      notionalUsd: 100,
      orderType: "market",
      reason: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["notionalUsd"]);
  });
});
