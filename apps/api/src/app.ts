import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { ZodError } from "zod";
import type { ServerConfig } from "./config.js";
import { loadServerConfig } from "./config.js";
import { ExchangeFactory, platformCapabilities } from "./exchanges/exchangeFactory.js";
import { SyntheticMarketDataSource } from "./services/marketData.js";
import { PaperExchangeAdapter } from "./exchanges/paperExchange.js";
import { aiConnectionSchema, createRunSchema, exchangeConnectionSchema } from "./schemas.js";
import { RoutedAiAgentProvider } from "./services/aiProvider.js";
import { CredentialVault } from "./services/credentialVault.js";
import { AgentOrchestrator } from "./services/orchestrator.js";
import { evaluateRisk } from "./services/riskEngine.js";

export type AppServices = {
  exchangeFactory: ExchangeFactory;
  orchestrator: AgentOrchestrator;
  vault: CredentialVault;
};

function requireSession(config: ServerConfig) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!config.sessionToken) {
      next();
      return;
    }

    if (request.header("X-Qonyx-Session") !== config.sessionToken) {
      response.status(401).json({ error: "A valid Qonyx session token is required." });
      return;
    }
    next();
  };
}

function getRunOr404(
  services: AppServices,
  request: Request,
  response: Response,
) {
  const run = services.orchestrator.getRun(paramId(request));
  if (!run) {
    response.status(404).json({ error: "Agent run was not found." });
    return undefined;
  }
  return run;
}

function paramId(request: Request) {
  const value = request.params.id;
  return Array.isArray(value) ? value[0] || "" : value;
}

export function createQonyxApp(options: {
  autoSchedule?: boolean;
  config?: ServerConfig;
  services?: AppServices;
} = {}) {
  const config = options.config ?? loadServerConfig();
  const vault = options.services?.vault ?? new CredentialVault();
  const exchangeFactory =
    options.services?.exchangeFactory ?? new ExchangeFactory(config, vault);
  const agentProvider = new RoutedAiAgentProvider(vault);
  const orchestrator =
    options.services?.orchestrator ??
    new AgentOrchestrator(agentProvider, exchangeFactory, {
      autoSchedule: options.autoSchedule,
    });
  const services: AppServices = { exchangeFactory, orchestrator, vault };
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      methods: ["DELETE", "GET", "POST"],
      origin: [
        "http://127.0.0.1:4173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://localhost:5173",
      ],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", requireSession(config));

  app.get("/api/health", (_request, response) => {
    response.json({
      mainnetTradingEnabled: config.allowMainnetTrading,
      liveTradingEnabled: config.enableLiveTrading,
      service: "qonyx-api",
      status: "ok",
      time: new Date().toISOString(),
    });
  });

  app.get("/api/platforms", (_request, response) => {
    response.json({ platforms: platformCapabilities });
  });

  app.get("/api/connections", (_request, response) => {
    response.json({ connections: vault.list() });
  });

  app.post("/api/connections/ai", (request, response) => {
    const input = aiConnectionSchema.parse(request.body);
    if (input.provider === "openai-compatible" && !input.apiKey) {
      response.status(400).json({ error: "An API key is required for this provider." });
      return;
    }
    const connection = vault.putAi(input.label, {
      apiKey: input.apiKey,
      baseUrl:
        input.baseUrl ||
        (input.provider === "ollama"
          ? "http://127.0.0.1:11434/v1"
          : input.provider === "openai-compatible"
            ? "https://api.openai.com/v1"
            : "http://127.0.0.1"),
      model: input.model,
      provider: input.provider,
    });
    response.status(201).json({ connection });
  });

  app.post("/api/connections/exchange", (request, response) => {
    const input = exchangeConnectionSchema.parse(request.body);
    const requiresApiCredentials = ["binance", "bitget", "bybit"].includes(input.platform);
    if (requiresApiCredentials && (!input.apiKey || !input.secret)) {
      response.status(400).json({
        error: `${input.platform} requires an API key and secret.`,
      });
      return;
    }
    if (input.platform === "bitget" && !input.passphrase) {
      response.status(400).json({ error: "Bitget requires an API passphrase." });
      return;
    }
    if (["moomoo", "webhook"].includes(input.platform) && !input.baseUrl) {
      response.status(400).json({
        error: `${input.platform} requires a gateway base URL.`,
      });
      return;
    }
    const connection = vault.putExchange(input.label, {
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      passphrase: input.passphrase,
      platform: input.platform,
      sandbox: input.sandbox,
      secret: input.secret,
    });
    response.status(201).json({ connection });
  });

  app.post("/api/connections/:id/test", async (request, response) => {
    const id = paramId(request);
    const ai = vault.getAi(id);
    if (ai) {
      const provider = new RoutedAiAgentProvider(vault);
      const marketData = new SyntheticMarketDataSource();
      const market = await marketData.getSnapshot("BTC/USD");
      const paper = new PaperExchangeAdapter(10_000, marketData);
      await paper.getMarketSnapshot("BTC/USD");
      const account = await paper.getAccount("BTC/USD");
      const signal = AbortSignal.timeout(30_000);
      const riskLimits = {
        capitalLimitUsd: 10_000,
        dailyLossLimitUsd: 500,
        maxOrderUsd: 1_000,
        maxPositionPercent: 0.25,
      };
      const analysis = await provider.analyze(
        { connectionId: id, name: "Connection test analyst", role: "analyst" },
        market,
        account,
        signal,
      );
      const intent = await provider.trade(
        { connectionId: id, name: "Connection test trader", role: "trader" },
        { account, analysis, market, riskLimits },
        signal,
      );
      const risk = evaluateRisk(intent, account, riskLimits, false);
      await provider.report(
        { connectionId: id, name: "Connection test reporter", role: "reporter" },
        { accountAfter: account, analysis, intent, risk },
        signal,
      );
      response.json({
        message: "Analyst, trader, and reporter returned valid structured output.",
        ok: true,
      });
      return;
    }

    const exchange = vault.getExchange(id);
    if (exchange) {
      const result = await exchangeFactory.createFromSecret(exchange).testConnection();
      response.json(result);
      return;
    }

    response.status(404).json({ error: "Connection was not found." });
  });

  app.delete("/api/connections/:id", (request, response) => {
    if (!vault.delete(paramId(request))) {
      response.status(404).json({ error: "Connection was not found." });
      return;
    }
    response.status(204).end();
  });

  app.get("/api/system/status", (_request, response) => {
    response.json({
      halted: orchestrator.globallyHalted,
      mainnetTradingEnabled: config.allowMainnetTrading,
      liveTradingEnabled: config.enableLiveTrading,
    });
  });

  app.post("/api/system/emergency-stop", async (request, response) => {
    const result = await orchestrator.emergencyStop(
      typeof request.body?.reason === "string"
        ? request.body.reason.slice(0, 300)
        : "Emergency stop activated by user",
    );
    response.json(result);
  });

  app.post("/api/system/unlock", (_request, response) => {
    response.json(orchestrator.unlock());
  });

  app.get("/api/agent-runs", (_request, response) => {
    response.json({ runs: orchestrator.listRuns() });
  });

  app.post("/api/agent-runs", async (request, response) => {
    const configInput = createRunSchema.parse(request.body);
    const run = await orchestrator.startRun(configInput);
    response.status(201).json({ run });
  });

  app.get("/api/agent-runs/:id", (request, response) => {
    const run = getRunOr404(services, request, response);
    if (run) {
      response.json({ run });
    }
  });

  app.get("/api/agent-runs/:id/events", (request, response) => {
    const run = getRunOr404(services, request, response);
    if (run) {
      response.json({ events: run.events });
    }
  });

  app.get("/api/agent-runs/:id/reports", (request, response) => {
    const run = getRunOr404(services, request, response);
    if (run) {
      response.json({
        reports: run.cycles.map((cycle) => ({
          completedAt: cycle.completedAt,
          cycleId: cycle.id,
          report: cycle.report,
          sequence: cycle.sequence,
        })),
      });
    }
  });

  app.post("/api/agent-runs/:id/cycle", async (request, response) => {
    if (!getRunOr404(services, request, response)) {
      return;
    }
    const run = await orchestrator.runOneCycle(paramId(request));
    response.json({ run });
  });

  app.post("/api/agent-runs/:id/stop", async (request, response) => {
    if (!getRunOr404(services, request, response)) {
      return;
    }
    const run = await orchestrator.stopRun(
      paramId(request),
      typeof request.body?.reason === "string"
        ? request.body.reason.slice(0, 300)
        : "Stopped by user",
    );
    response.json({ run });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "API route was not found." });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: "Request validation failed.",
        issues: error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path.join("."),
        })),
      });
      return;
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status =
      message.includes("disabled") || message.includes("Emergency stop") ? 409 : 500;
    response.status(status).json({ error: message });
  };
  app.use(errorHandler);

  return { app, config, services };
}
