import request from "supertest";
import { describe, expect, it } from "vitest";
import { createQonyxApp } from "../src/app.js";

function buildRunPayload() {
  return {
    agents: {
      analyst: { name: "Atlas", role: "analyst" },
      reporter: { name: "Ledger", role: "reporter" },
      trader: { name: "Vector", role: "trader" },
    },
    cycleIntervalMs: 5_000,
    maxCycles: 0,
    mode: "paper",
    name: "API sandbox",
    platform: "paper",
    risk: {
      capitalLimitUsd: 10_000,
      dailyLossLimitUsd: 500,
      maxOrderUsd: 1_000,
      maxPositionPercent: 0.2,
    },
    symbol: "BTC/USD",
  };
}

describe("Qonyx API", () => {
  it("exposes health and supported exchange capabilities", async () => {
    const { app } = createQonyxApp({ autoSchedule: false });
    const health = await request(app).get("/api/health").expect(200);
    const platforms = await request(app).get("/api/platforms").expect(200);

    expect(health.body.status).toBe("ok");
    expect(platforms.body.platforms.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(["paper", "binance", "bitget", "bybit", "moomoo", "webhook"]),
    );
  });

  it("keeps BYOK secrets out of connection responses", async () => {
    const { app } = createQonyxApp({ autoSchedule: false });
    const result = await request(app)
      .post("/api/connections/ai")
      .send({
        apiKey: "test-api-key-1234",
        label: "Test model",
        model: "test-model",
        provider: "openai-compatible",
      })
      .expect(201);

    expect(result.body.connection.secretLast4).toBe("1234");
    expect(JSON.stringify(result.body)).not.toContain("test-api-key");
  });

  it("starts a paper run, force-stops it, and locks the system", async () => {
    const { app } = createQonyxApp({ autoSchedule: false });
    const created = await request(app)
      .post("/api/agent-runs")
      .send(buildRunPayload())
      .expect(201);

    await request(app)
      .post("/api/system/emergency-stop")
      .send({ reason: "API integration test" })
      .expect(200);
    const run = await request(app)
      .get(`/api/agent-runs/${created.body.run.id}`)
      .expect(200);

    expect(run.body.run.status).toBe("stopped");
    await request(app).post("/api/agent-runs").send(buildRunPayload()).expect(409);
  });

  it("rejects an invalid fund configuration", async () => {
    const { app } = createQonyxApp({ autoSchedule: false });
    const payload = buildRunPayload();
    payload.risk.maxOrderUsd = 20_000;

    const result = await request(app).post("/api/agent-runs").send(payload).expect(400);
    expect(result.body.issues[0].path).toBe("risk.maxOrderUsd");
  });

  it("keeps live exchange execution disabled by server policy", async () => {
    const { app } = createQonyxApp({ autoSchedule: false });
    const connection = await request(app)
      .post("/api/connections/exchange")
      .send({
        apiKey: "test-exchange-key",
        label: "Binance testnet",
        platform: "binance",
        sandbox: true,
        secret: "test-exchange-secret",
      })
      .expect(201);
    const payload = {
      ...buildRunPayload(),
      exchangeConnectionId: connection.body.connection.id,
      mode: "live",
      platform: "binance",
    };

    const result = await request(app).post("/api/agent-runs").send(payload).expect(409);

    expect(result.body.error).toMatch(/Live trading is disabled/);
  });
});
