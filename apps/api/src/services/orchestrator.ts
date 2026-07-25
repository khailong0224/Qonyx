import { randomUUID } from "node:crypto";
import type {
  AgentRun,
  AgentRunConfig,
  AgentStep,
  AiAgentProvider,
  ExchangeAdapter,
  OrderResult,
  RunCycle,
  TradingReport,
} from "../domain.js";
import type { ExchangeFactory } from "../exchanges/exchangeFactory.js";
import { evaluateRisk } from "./riskEngine.js";

type RunResources = {
  abortController?: AbortController;
  adapter: ExchangeAdapter;
  hasOpenOrders: boolean;
  reservedBuyNotionalUsd: number;
  reservedSellNotionalUsd: number;
  timer?: NodeJS.Timeout;
};

function timestamp() {
  return new Date().toISOString();
}

function skippedStep(role: AgentStep["role"], name: string, error: string): AgentStep {
  const now = timestamp();
  return {
    completedAt: now,
    error,
    name,
    role,
    startedAt: now,
    status: "skipped",
  };
}

function fallbackReport(error: unknown): TradingReport {
  return {
    action: "Audit fallback generated",
    budgetSummary: "Inspect the cycle account snapshots for exact budget usage.",
    headline: "Reporter agent could not complete",
    narrative:
      error instanceof Error
        ? error.message
        : "The reporter failed after the risk and execution stages completed.",
    riskSummary: "The deterministic risk decision remains authoritative.",
  };
}

export class AgentOrchestrator {
  readonly #agentProvider: AiAgentProvider;
  readonly #autoSchedule: boolean;
  readonly #exchangeFactory: Pick<ExchangeFactory, "createForRun">;
  readonly #resources = new Map<string, RunResources>();
  readonly #runs = new Map<string, AgentRun>();
  readonly #runningCycles = new Set<string>();
  #globallyHalted = false;

  constructor(
    agentProvider: AiAgentProvider,
    exchangeFactory: Pick<ExchangeFactory, "createForRun">,
    options: { autoSchedule?: boolean } = {},
  ) {
    this.#agentProvider = agentProvider;
    this.#exchangeFactory = exchangeFactory;
    this.#autoSchedule = options.autoSchedule ?? true;
  }

  get globallyHalted() {
    return this.#globallyHalted;
  }

  getRun(id: string) {
    return this.#runs.get(id);
  }

  listRuns() {
    return [...this.#runs.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async startRun(config: AgentRunConfig) {
    if (this.#globallyHalted) {
      throw new Error("Emergency stop is active. Unlock trading before starting an agent.");
    }

    const adapter = this.#exchangeFactory.createForRun(config);
    await adapter.testConnection();
    const now = timestamp();
    const run: AgentRun = {
      config,
      createdAt: now,
      cycles: [],
      id: randomUUID(),
      startedAt: now,
      status: "running",
      updatedAt: now,
    };
    this.#runs.set(run.id, run);
    this.#resources.set(run.id, {
      adapter,
      hasOpenOrders: false,
      reservedBuyNotionalUsd: 0,
      reservedSellNotionalUsd: 0,
    });

    if (this.#autoSchedule) {
      this.#schedule(run.id, 0);
    }

    return run;
  }

  async runOneCycle(id: string) {
    const run = this.#runs.get(id);
    const resources = this.#resources.get(id);
    if (!run || !resources) {
      throw new Error("Agent run was not found.");
    }
    if (run.status !== "running") {
      throw new Error(`Agent run is ${run.status} and cannot execute another cycle.`);
    }
    if (this.#globallyHalted) {
      throw new Error("Emergency stop blocks new cycles.");
    }
    if (this.#runningCycles.has(id)) {
      return run;
    }

    this.#runningCycles.add(id);
    const abortController = new AbortController();
    resources.abortController = abortController;
    const steps: AgentStep[] = [];
    const startedAt = timestamp();

    try {
      const market = await resources.adapter.getMarketSnapshot(
        run.config.symbol,
        abortController.signal,
      );
      const accountBefore = await resources.adapter.getAccount(run.config.symbol);
      const analystStartedAt = timestamp();
      const analysis = await this.#agentProvider.analyze(
        run.config.agents.analyst,
        market,
        accountBefore,
        abortController.signal,
      );
      steps.push({
        completedAt: timestamp(),
        name: run.config.agents.analyst.name,
        output: analysis,
        role: "analyst",
        startedAt: analystStartedAt,
        status: "completed",
      });

      const traderStartedAt = timestamp();
      const tradeIntent = await this.#agentProvider.trade(
        run.config.agents.trader,
        {
          account: accountBefore,
          analysis,
          market,
          riskLimits: run.config.risk,
        },
        abortController.signal,
      );
      steps.push({
        completedAt: timestamp(),
        name: run.config.agents.trader.name,
        output: tradeIntent,
        role: "trader",
        startedAt: traderStartedAt,
        status: "completed",
      });

      const riskAccount =
        tradeIntent.action === "sell"
          ? {
              ...accountBefore,
              exposureUsd: Math.max(
                0,
                accountBefore.exposureUsd - resources.reservedSellNotionalUsd,
              ),
            }
          : {
              ...accountBefore,
              availableCashUsd: Math.min(
                accountBefore.availableCashUsd,
                Math.max(
                  0,
                  run.config.risk.capitalLimitUsd -
                    accountBefore.exposureUsd -
                    resources.reservedBuyNotionalUsd,
                ),
              ),
              exposureUsd:
                accountBefore.exposureUsd + resources.reservedBuyNotionalUsd,
            };
      const risk = evaluateRisk(
        tradeIntent,
        riskAccount,
        run.config.risk,
        this.#globallyHalted,
      );
      let order: OrderResult | undefined;
      if (risk.approved && risk.intent.action !== "hold") {
        abortController.signal.throwIfAborted();
        order = await resources.adapter.placeOrder(
          risk.intent,
          run.config.symbol,
        );
        resources.hasOpenOrders ||= order.status === "open";
        if (abortController.signal.aborted) {
          await resources.adapter.cancelAllOrders(run.config.symbol);
          resources.hasOpenOrders = false;
          resources.reservedBuyNotionalUsd = 0;
          resources.reservedSellNotionalUsd = 0;
          abortController.signal.throwIfAborted();
        }
      }
      if (order?.status === "open" && order.action === "buy") {
        resources.reservedBuyNotionalUsd +=
          order.requestedNotionalUsd ?? risk.intent.notionalUsd;
      }
      if (order?.status === "open" && order.action === "sell") {
        resources.reservedSellNotionalUsd +=
          order.requestedNotionalUsd ?? risk.intent.notionalUsd;
      }
      const accountAfter = await resources.adapter.getAccount(run.config.symbol);

      const reporterStartedAt = timestamp();
      let report: TradingReport;
      try {
        report = await this.#agentProvider.report(
          run.config.agents.reporter,
          { accountAfter, analysis, intent: tradeIntent, order, risk },
          abortController.signal,
        );
        steps.push({
          completedAt: timestamp(),
          name: run.config.agents.reporter.name,
          output: report,
          role: "reporter",
          startedAt: reporterStartedAt,
          status: "completed",
        });
      } catch (error) {
        report = fallbackReport(error);
        steps.push({
          completedAt: timestamp(),
          error: error instanceof Error ? error.message : "Reporter failed.",
          name: run.config.agents.reporter.name,
          output: report,
          role: "reporter",
          startedAt: reporterStartedAt,
          status: "failed",
        });
      }

      const cycle: RunCycle = {
        accountAfter,
        accountBefore,
        analysis,
        completedAt: timestamp(),
        id: randomUUID(),
        market,
        order,
        report,
        risk,
        sequence: run.cycles.length + 1,
        startedAt,
        steps,
        tradeIntent,
      };
      run.cycles.push(cycle);
      run.updatedAt = timestamp();

      if (run.config.maxCycles > 0 && run.cycles.length >= run.config.maxCycles) {
        try {
          await resources.adapter.cancelAllOrders(run.config.symbol);
          resources.hasOpenOrders = false;
          resources.reservedBuyNotionalUsd = 0;
          resources.reservedSellNotionalUsd = 0;
          run.status = "completed";
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown cancellation failure.";
          resources.hasOpenOrders = true;
          run.lastError =
            `Configured cycle limit reached, but order cancellation failed; ` +
            `manual exchange cancellation is required: ${message}`;
          run.status = "failed";
        }
        run.stoppedAt = timestamp();
        run.stopReason = "Configured cycle limit reached.";
        run.updatedAt = timestamp();
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        if (resources.hasOpenOrders) {
          try {
            await resources.adapter.cancelAllOrders(run.config.symbol);
            resources.hasOpenOrders = false;
            resources.reservedBuyNotionalUsd = 0;
            resources.reservedSellNotionalUsd = 0;
            if (run.lastError?.includes("manual exchange cancellation")) {
              run.lastError = undefined;
            }
          } catch (cancellationError) {
            const message =
              cancellationError instanceof Error
                ? cancellationError.message
                : "Unknown cancellation failure.";
            run.lastError =
              `Order cancellation failed; manual exchange cancellation is required: ${message}`;
          }
        }
        run.status = resources.hasOpenOrders ? "failed" : "stopped";
        run.stoppedAt ||= timestamp();
        run.updatedAt = timestamp();
      } else {
        let message = error instanceof Error ? error.message : "Agent cycle failed.";
        if (resources.hasOpenOrders) {
          try {
            await resources.adapter.cancelAllOrders(run.config.symbol);
            resources.hasOpenOrders = false;
            resources.reservedBuyNotionalUsd = 0;
            resources.reservedSellNotionalUsd = 0;
          } catch (cancellationError) {
            const cancellationMessage =
              cancellationError instanceof Error
                ? cancellationError.message
                : "Unknown cancellation failure.";
            message +=
              ` Order cancellation failed; manual exchange cancellation is required: ` +
              cancellationMessage;
          }
        }
        const roles = new Set(steps.map((step) => step.role));
        if (!roles.has("analyst")) {
          steps.push(skippedStep("analyst", run.config.agents.analyst.name, message));
        }
        if (!roles.has("trader")) {
          steps.push(skippedStep("trader", run.config.agents.trader.name, "Analyst stage failed."));
        }
        if (!roles.has("reporter")) {
          steps.push(skippedStep("reporter", run.config.agents.reporter.name, "Trading pipeline failed."));
        }
        run.lastError = message;
        run.status = "failed";
        run.stoppedAt = timestamp();
        run.updatedAt = timestamp();
      }
    } finally {
      resources.abortController = undefined;
      this.#runningCycles.delete(id);
    }

    if (this.#autoSchedule && run.status === "running") {
      this.#schedule(id, run.config.cycleIntervalMs);
    }

    return run;
  }

  async stopRun(id: string, reason = "Stopped by user") {
    const run = this.#runs.get(id);
    const resources = this.#resources.get(id);
    if (!run || !resources) {
      throw new Error("Agent run was not found.");
    }

    if (
      ["completed", "failed", "stopped"].includes(run.status) &&
      !resources.hasOpenOrders
    ) {
      return run;
    }

    run.status = "stopping";
    run.stopReason = reason;
    run.updatedAt = timestamp();
    if (resources.timer) {
      clearTimeout(resources.timer);
      resources.timer = undefined;
    }
    resources.abortController?.abort(reason);
    try {
      await resources.adapter.cancelAllOrders(run.config.symbol);
      resources.hasOpenOrders = false;
      resources.reservedBuyNotionalUsd = 0;
      resources.reservedSellNotionalUsd = 0;
      if (run.lastError?.includes("manual exchange cancellation")) {
        run.lastError = undefined;
      }
      run.status = "stopped";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown cancellation failure.";
      resources.hasOpenOrders = true;
      run.lastError =
        `Order cancellation failed; manual exchange cancellation is required: ${message}`;
      run.status = "failed";
    }
    run.stoppedAt = timestamp();
    run.updatedAt = timestamp();
    return run;
  }

  async emergencyStop(reason = "Emergency stop activated") {
    this.#globallyHalted = true;
    const activeRuns = this.listRuns().filter((run) => {
      const resources = this.#resources.get(run.id);
      return (
        ["running", "starting", "stopping"].includes(run.status) ||
        resources?.hasOpenOrders === true
      );
    });
    await Promise.all(activeRuns.map((run) => this.stopRun(run.id, reason)));
    return {
      cancellationFailures: activeRuns
        .filter((run) => run.lastError?.includes("manual exchange cancellation"))
        .map((run) => run.id),
      halted: true,
      stoppedRuns: activeRuns.map((run) => run.id),
    };
  }

  unlock() {
    this.#globallyHalted = false;
    return { halted: false };
  }

  #schedule(id: string, delay: number) {
    const resources = this.#resources.get(id);
    if (!resources) {
      return;
    }
    if (resources.timer) {
      clearTimeout(resources.timer);
    }
    resources.timer = setTimeout(() => {
      resources.timer = undefined;
      void this.runOneCycle(id);
    }, delay);
    resources.timer.unref();
  }
}
