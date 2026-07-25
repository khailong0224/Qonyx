import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQonyxApp } from "../src/app.js";

afterEach(() => {
  vi.restoreAllMocks();
});

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
    expect(health.body.mainnetTradingEnabled).toBe(false);
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

  it("enforces the optional API session token", async () => {
    const { app } = createQonyxApp({
      autoSchedule: false,
      config: {
        allowMainnetTrading: false,
        enableLiveTrading: false,
        host: "127.0.0.1",
        port: 8_787,
        sessionToken: "test-session-token",
      },
    });

    await request(app).get("/api/health").expect(401);
    const result = await request(app)
      .get("/api/health")
      .set("X-Qonyx-Session", "test-session-token")
      .expect(200);

    expect(result.body.status).toBe("ok");
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

  it("requires a second explicit opt-in before using a mainnet connection", async () => {
    const { app } = createQonyxApp({
      autoSchedule: false,
      config: {
        allowMainnetTrading: false,
        enableLiveTrading: true,
        host: "127.0.0.1",
        port: 8_787,
      },
    });
    const connection = await request(app)
      .post("/api/connections/exchange")
      .send({
        apiKey: "test-exchange-key",
        label: "Mainnet connection",
        platform: "binance",
        sandbox: false,
        secret: "test-exchange-secret",
      })
      .expect(201);

    const result = await request(app)
      .post("/api/agent-runs")
      .send({
        ...buildRunPayload(),
        exchangeConnectionId: connection.body.connection.id,
        mode: "live",
        platform: "binance",
      })
      .expect(409);

    expect(result.body.error).toMatch(/Mainnet trading is disabled/);
  });

  it("tests valid structured output from every AI role", async () => {
    const responses = [
      {
        confidence: 0.8,
        direction: "bullish",
        rationale: "Momentum is positive.",
        riskFlags: [],
        signals: ["Positive momentum"],
        summary: "Bullish test.",
      },
      {
        action: "buy",
        notionalUsd: 100,
        orderType: "market",
        reason: "Structured trade test.",
      },
      {
        action: "BUY 100 USD",
        budgetSummary: "Budget remains.",
        headline: "Connection test complete",
        narrative: "All roles returned typed output.",
        riskSummary: "Limits remained satisfied.",
      },
    ];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        const content = responses.shift();
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(content) } }],
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      });
    const { app } = createQonyxApp({ autoSchedule: false });
    const connection = await request(app)
      .post("/api/connections/ai")
      .send({
        apiKey: "test-api-key-1234",
        baseUrl: "https://ai.example.test/v1",
        label: "Three-role test",
        model: "test-model",
        provider: "openai-compatible",
      })
      .expect(201);

    const result = await request(app)
      .post(`/api/connections/${connection.body.connection.id}/test`)
      .expect(200);

    expect(result.body.message).toMatch(/Analyst, trader, and reporter/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects connection URLs that embed credentials", async () => {
    const { app } = createQonyxApp({ autoSchedule: false });

    const result = await request(app)
      .post("/api/connections/ai")
      .send({
        apiKey: "test-api-key-1234",
        baseUrl: "https://user:password@ai.example.test/v1",
        label: "Unsafe URL",
        model: "test-model",
        provider: "openai-compatible",
      })
      .expect(400);

    expect(result.body.issues[0].message).toMatch(/must not include/);
  });

  it("accepts venue-style symbols only for gateway platforms", async () => {
    const { app } = createQonyxApp({ autoSchedule: false });

    await request(app)
      .post("/api/agent-runs")
      .send({ ...buildRunPayload(), symbol: "US.AAPL" })
      .expect(400);

    const gatewayPayload = {
      ...buildRunPayload(),
      exchangeConnectionId: "da138baa-4b28-4b43-84fe-4b3017295b5e",
      mode: "live",
      platform: "moomoo",
      symbol: "US.AAPL",
    };
    const parsedFailure = await request(app)
      .post("/api/agent-runs")
      .send(gatewayPayload)
      .expect(409);

    expect(parsedFailure.body.error).toMatch(/Live trading is disabled/);
  });
});
