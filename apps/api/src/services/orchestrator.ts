import { randomUUID } from "node:crypto";
import type {
  AgentRun,
  AgentRunConfig,
  AgentStep,
  AiAgentProvider,
  ExchangeAdapter,
  OrderResult,
  RunCycle,
  RunEvent,
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

const MAX_RUN_EVENTS = 2_000;

function timestamp() {
  return new Date().toISOString();
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
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
      events: [],
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
    this.#recordEvent(run, {
      category: "system",
      level: "info",
      message: "Exchange connection validated.",
      metadata: {
        platform: config.platform,
        symbol: config.symbol,
      },
    });
    this.#recordEvent(run, {
      category: "run",
      level: "info",
      message: `Run started in ${config.mode} mode.`,
      metadata: {
        maxCycles: config.maxCycles,
        platform: config.platform,
        symbol: config.symbol,
      },
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
    const cycleStartedAt = Date.now();
    const cycleSequence = run.cycles.length + 1;
    let activeStage:
      | {
          category: RunEvent["category"];
          failureMessage: string;
          role?: RunEvent["role"];
          startedAt: number;
        }
      | undefined;
    this.#recordEvent(run, {
      category: "run",
      cycleSequence,
      level: "info",
      message: `Cycle ${cycleSequence} started.`,
    });

    try {
      const snapshotStartedAt = Date.now();
      activeStage = {
        category: "system",
        failureMessage: "Market or account snapshot loading failed.",
        startedAt: snapshotStartedAt,
      };
      const market = await resources.adapter.getMarketSnapshot(
        run.config.symbol,
        abortController.signal,
      );
      const accountBefore = await resources.adapter.getAccount(run.config.symbol);
      activeStage = undefined;
      this.#recordEvent(run, {
        category: "system",
        cycleSequence,
        durationMs: elapsedMs(snapshotStartedAt),
        level: "info",
        message: "Market and account snapshots loaded.",
        metadata: {
          exposureUsd: accountBefore.exposureUsd,
          price: market.price,
        },
      });
      const analystStartedAt = timestamp();
      const analystStartedAtMs = Date.now();
      activeStage = {
        category: "agent",
        failureMessage: `${run.config.agents.analyst.name} failed during market analysis.`,
        role: "analyst",
        startedAt: analystStartedAtMs,
      };
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
      activeStage = undefined;
      this.#recordEvent(run, {
        category: "agent",
        cycleSequence,
        durationMs: elapsedMs(analystStartedAtMs),
        level: "info",
        message: `${run.config.agents.analyst.name} completed market analysis.`,
        metadata: {
          confidence: analysis.confidence,
          direction: analysis.direction,
        },
        role: "analyst",
      });

      const traderStartedAt = timestamp();
      const traderStartedAtMs = Date.now();
      activeStage = {
        category: "agent",
        failureMessage: `${run.config.agents.trader.name} failed while preparing a trade intent.`,
        role: "trader",
        startedAt: traderStartedAtMs,
      };
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
      activeStage = undefined;
      this.#recordEvent(run, {
        category: "agent",
        cycleSequence,
        durationMs: elapsedMs(traderStartedAtMs),
        level: "info",
        message: `${run.config.agents.trader.name} proposed a ${tradeIntent.action} action.`,
        metadata: {
          action: tradeIntent.action,
          notionalUsd: tradeIntent.notionalUsd,
          orderType: tradeIntent.orderType,
        },
        role: "trader",
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
      this.#recordEvent(run, {
        category: "risk",
        cycleSequence,
        level: risk.violations.length > 0 ? "warning" : "info",
        message: !risk.approved
          ? "Risk gate blocked the trade intent."
          : risk.violations.length > 0
            ? "Risk gate adjusted and approved the trade intent."
            : "Risk gate approved the trade intent.",
        metadata: {
          action: risk.intent.action,
          approved: risk.approved,
          remainingBudgetUsd: risk.remainingBudgetUsd,
          violationCount: risk.violations.length,
        },
      });
      let order: OrderResult | undefined;
      if (risk.approved && risk.intent.action !== "hold") {
        abortController.signal.throwIfAborted();
        const orderStartedAt = Date.now();
        activeStage = {
          category: "order",
          failureMessage: "Order submission failed.",
          startedAt: orderStartedAt,
        };
        order = await resources.adapter.placeOrder(
          risk.intent,
          run.config.symbol,
        );
        activeStage = undefined;
        this.#recordEvent(run, {
          category: "order",
          cycleSequence,
          durationMs: elapsedMs(orderStartedAt),
          level:
            order.status === "rejected" || order.status === "cancelled"
              ? "warning"
              : "info",
          message: `Order ${order.status}: ${order.action} ${order.notionalUsd.toFixed(2)} USD.`,
          metadata: {
            action: order.action,
            notionalUsd: order.notionalUsd,
            orderId: order.id,
            status: order.status,
          },
        });
        resources.hasOpenOrders ||= order.status === "open";
        if (abortController.signal.aborted) {
          await resources.adapter.cancelAllOrders(run.config.symbol);
          resources.hasOpenOrders = false;
          resources.reservedBuyNotionalUsd = 0;
          resources.reservedSellNotionalUsd = 0;
          this.#recordEvent(run, {
            category: "order",
            cycleSequence,
            level: "warning",
            message: "Orders cancelled after a stop raced with order submission.",
          });
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
      activeStage = {
        category: "system",
        failureMessage: "Post-trade account snapshot loading failed.",
        startedAt: Date.now(),
      };
      const accountAfter = await resources.adapter.getAccount(run.config.symbol);
      activeStage = undefined;

      const reporterStartedAt = timestamp();
      const reporterStartedAtMs = Date.now();
      activeStage = {
        category: "agent",
        failureMessage: `${run.config.agents.reporter.name} failed while preparing the report.`,
        role: "reporter",
        startedAt: reporterStartedAtMs,
      };
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
        activeStage = undefined;
        this.#recordEvent(run, {
          category: "agent",
          cycleSequence,
          durationMs: elapsedMs(reporterStartedAtMs),
          level: "info",
          message: `${run.config.agents.reporter.name} completed the cycle report.`,
          role: "reporter",
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          throw error;
        }
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
        activeStage = undefined;
        this.#recordEvent(run, {
          category: "agent",
          cycleSequence,
          durationMs: elapsedMs(reporterStartedAtMs),
          level: "warning",
          message: `${run.config.agents.reporter.name} failed; a fallback report was generated.`,
          metadata: {
            error: error instanceof Error ? error.message : "Reporter failed.",
          },
          role: "reporter",
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
        sequence: cycleSequence,
        startedAt,
        steps,
        tradeIntent,
      };
      run.cycles.push(cycle);
      this.#recordEvent(run, {
        category: "run",
        cycleSequence,
        durationMs: elapsedMs(cycleStartedAt),
        level: "info",
        message: `Cycle ${cycleSequence} completed.`,
        metadata: {
          action: tradeIntent.action,
          orderSubmitted: Boolean(order),
          riskApproved: risk.approved,
        },
      });

      if (run.config.maxCycles > 0 && run.cycles.length >= run.config.maxCycles) {
        try {
          await resources.adapter.cancelAllOrders(run.config.symbol);
          resources.hasOpenOrders = false;
          resources.reservedBuyNotionalUsd = 0;
          resources.reservedSellNotionalUsd = 0;
          run.status = "completed";
          this.#recordEvent(run, {
            category: "order",
            cycleSequence,
            level: "info",
            message: "Final open-order cancellation request completed.",
          });
          this.#recordEvent(run, {
            category: "run",
            cycleSequence,
            level: "info",
            message: "Configured cycle limit reached; run completed.",
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown cancellation failure.";
          resources.hasOpenOrders = true;
          run.lastError =
            `Configured cycle limit reached, but order cancellation failed; ` +
            `manual exchange cancellation is required: ${message}`;
          run.status = "failed";
          this.#recordEvent(run, {
            category: "order",
            cycleSequence,
            level: "error",
            message: "Final open-order cancellation failed; manual action is required.",
            metadata: { error: message },
          });
        }
        run.stoppedAt = timestamp();
        run.stopReason = "Configured cycle limit reached.";
        run.updatedAt = timestamp();
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        this.#recordEvent(run, {
          category: "run",
          cycleSequence,
          durationMs: elapsedMs(cycleStartedAt),
          level: "warning",
          message: `Cycle ${cycleSequence} was interrupted by a stop request.`,
        });
        if (resources.hasOpenOrders) {
          try {
            await resources.adapter.cancelAllOrders(run.config.symbol);
            resources.hasOpenOrders = false;
            resources.reservedBuyNotionalUsd = 0;
            resources.reservedSellNotionalUsd = 0;
            if (run.lastError?.includes("manual exchange cancellation")) {
              run.lastError = undefined;
            }
            this.#recordEvent(run, {
              category: "order",
              cycleSequence,
              level: "info",
              message: "Open orders were cancelled after the interrupted cycle.",
            });
          } catch (cancellationError) {
            const message =
              cancellationError instanceof Error
                ? cancellationError.message
                : "Unknown cancellation failure.";
            run.lastError =
              `Order cancellation failed; manual exchange cancellation is required: ${message}`;
            this.#recordEvent(run, {
              category: "order",
              cycleSequence,
              level: "error",
              message: "Order cancellation failed; manual action is required.",
              metadata: { error: message },
            });
          }
        }
        run.status = resources.hasOpenOrders ? "failed" : "stopped";
        run.stoppedAt ||= timestamp();
        run.updatedAt = timestamp();
      } else {
        let message = error instanceof Error ? error.message : "Agent cycle failed.";
        if (activeStage) {
          this.#recordEvent(run, {
            category: activeStage.category,
            cycleSequence,
            durationMs: elapsedMs(activeStage.startedAt),
            level: "error",
            message: activeStage.failureMessage,
            metadata: { error: message },
            role: activeStage.role,
          });
        }
        if (resources.hasOpenOrders) {
          try {
            await resources.adapter.cancelAllOrders(run.config.symbol);
            resources.hasOpenOrders = false;
            resources.reservedBuyNotionalUsd = 0;
            resources.reservedSellNotionalUsd = 0;
            this.#recordEvent(run, {
              category: "order",
              cycleSequence,
              level: "info",
              message: "Open orders were cancelled after the cycle failure.",
            });
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
        this.#recordEvent(run, {
          category: "run",
          cycleSequence,
          durationMs: elapsedMs(cycleStartedAt),
          level: "error",
          message: `Cycle ${cycleSequence} failed; the run was stopped.`,
          metadata: { error: message },
        });
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
    this.#recordEvent(run, {
      category: "run",
      level: "warning",
      message: "Stop requested.",
      metadata: { reason },
    });
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
      this.#recordEvent(run, {
        category: "order",
        level: "info",
        message: "Open-order cancellation request completed.",
      });
      this.#recordEvent(run, {
        category: "run",
        level: "info",
        message: "Run stopped.",
        metadata: { reason },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown cancellation failure.";
      resources.hasOpenOrders = true;
      run.lastError =
        `Order cancellation failed; manual exchange cancellation is required: ${message}`;
      run.status = "failed";
      this.#recordEvent(run, {
        category: "order",
        level: "error",
        message: "Order cancellation failed; manual action is required.",
        metadata: { error: message },
      });
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

  #recordEvent(run: AgentRun, event: Omit<RunEvent, "id" | "timestamp">) {
    const eventTimestamp = timestamp();
    run.events.push({
      ...event,
      id: randomUUID(),
      timestamp: eventTimestamp,
    });
    if (run.events.length > MAX_RUN_EVENTS) {
      run.events.splice(0, run.events.length - MAX_RUN_EVENTS);
    }
    run.updatedAt = eventTimestamp;
  }
}
