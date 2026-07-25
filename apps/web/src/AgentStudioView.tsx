import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CircleDollarSign,
  FileText,
  Gauge,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RunActivityLog } from "./RunActivityLog";
import {
  qonyxApi,
  type AgentRun,
  type ConnectionSummary,
  type ExchangePlatform,
} from "./services/qonyxApi";

const money = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  style: "currency",
});

const roles = [
  {
    description: "Reads market and account context, then returns structured signals only.",
    icon: BrainCircuit,
    key: "analyst",
    name: "Atlas Analyst",
    title: "1. Analysis",
  },
  {
    description: "Receives Atlas output and proposes one typed buy, sell, or hold intent.",
    icon: Bot,
    key: "trader",
    name: "Vector Trader",
    title: "2. Trade proposal",
  },
  {
    description: "Explains the risk decision, execution result, and remaining budget.",
    icon: FileText,
    key: "reporter",
    name: "Ledger Reporter",
    title: "3. Report",
  },
] as const;

type RoleKey = (typeof roles)[number]["key"];

function statusTone(status: AgentRun["status"]) {
  if (status === "running") {
    return "active";
  }
  if (status === "failed" || status === "risk-blocked") {
    return "risk";
  }
  if (status === "completed") {
    return "ai";
  }
  return "paused";
}

export function AgentStudioView() {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string>();
  const [systemHalted, setSystemHalted] = useState(false);
  const [liveTradingEnabled, setLiveTradingEnabled] = useState(false);
  const [mainnetTradingEnabled, setMainnetTradingEnabled] = useState(false);
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [symbol, setSymbol] = useState("BTC/USD");
  const [capital, setCapital] = useState(10_000);
  const [maxOrder, setMaxOrder] = useState(1_000);
  const [dailyLoss, setDailyLoss] = useState(500);
  const [maxPositionPercent, setMaxPositionPercent] = useState(25);
  const [cycleSeconds, setCycleSeconds] = useState(30);
  const [maxCycles, setMaxCycles] = useState(20);
  const [exchangeConnectionId, setExchangeConnectionId] = useState("");
  const [agentConnections, setAgentConnections] = useState<Record<RoleKey, string>>({
    analyst: "",
    reporter: "",
    trader: "",
  });
  const [busyAction, setBusyAction] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const aiConnections = connections.filter((connection) => connection.kind === "ai");
  const exchangeConnections = connections.filter(
    (connection) => connection.kind === "exchange",
  );
  const currentRun =
    runs.find((run) => run.id === currentRunId) ??
    runs.find((run) => run.status === "running") ??
    runs[0];
  const latestCycle =
    currentRun && currentRun.cycles.length > 0
      ? currentRun.cycles[currentRun.cycles.length - 1]
      : undefined;
  const selectedExchange = exchangeConnections.find(
    (connection) => connection.id === exchangeConnectionId,
  );
  const modePlatform: ExchangePlatform =
    mode === "paper" ? "paper" : selectedExchange?.platform || "paper";

  const refresh = async () => {
    const [connectionResult, runResult, status] = await Promise.all([
      qonyxApi.getConnections(),
      qonyxApi.getRuns(),
      qonyxApi.getSystemStatus(),
    ]);
    setConnections(connectionResult.connections);
    setRuns(runResult.runs);
    setSystemHalted(status.halted);
    setLiveTradingEnabled(status.liveTradingEnabled);
    setMainnetTradingEnabled(status.mainnetTradingEnabled);
  };

  useEffect(() => {
    refresh().catch((refreshError: unknown) => {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to reach the Qonyx API.",
      );
    });
  }, []);

  useEffect(() => {
    if (!currentRun || currentRun.status !== "running") {
      return;
    }
    const timer = window.setInterval(() => {
      qonyxApi
        .getRun(currentRun.id)
        .then(({ run }) => {
          setRuns((existing) => [
            run,
            ...existing.filter((item) => item.id !== run.id),
          ]);
        })
        .catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [currentRun?.id, currentRun?.status]);

  const assignedProviderNames = useMemo(
    () =>
      Object.fromEntries(
        roles.map((role) => [
          role.key,
          aiConnections.find(
            (connection) => connection.id === agentConnections[role.key],
          )?.label || "Built-in sandbox",
        ]),
      ) as Record<RoleKey, string>,
    [agentConnections, aiConnections],
  );

  const perform = async (name: string, action: () => Promise<void>) => {
    setBusyAction(name);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The action could not complete.",
      );
    } finally {
      setBusyAction(undefined);
    }
  };

  const startRun = () =>
    perform("start", async () => {
      if (mode === "live" && !exchangeConnectionId) {
        throw new Error("Choose a tested exchange connection before live mode.");
      }
      if (
        mode === "live" &&
        selectedExchange?.sandbox === false &&
        !mainnetTradingEnabled
      ) {
        throw new Error(
          "This is a mainnet connection, but mainnet trading is disabled by server policy.",
        );
      }
      const connectionFor = (role: RoleKey) =>
        agentConnections[role]
          ? { connectionId: agentConnections[role] }
          : {};
      const { run } = await qonyxApi.startRun({
        agents: {
          analyst: {
            ...connectionFor("analyst"),
            name: "Atlas Analyst",
            role: "analyst",
          },
          reporter: {
            ...connectionFor("reporter"),
            name: "Ledger Reporter",
            role: "reporter",
          },
          trader: {
            ...connectionFor("trader"),
            name: "Vector Trader",
            role: "trader",
          },
        },
        cycleIntervalMs: cycleSeconds * 1_000,
        exchangeConnectionId: mode === "live" ? exchangeConnectionId : undefined,
        maxCycles,
        mode,
        name: `${symbol} three-agent run`,
        platform: modePlatform,
        risk: {
          capitalLimitUsd: capital,
          dailyLossLimitUsd: dailyLoss,
          maxOrderUsd: maxOrder,
          maxPositionPercent: maxPositionPercent / 100,
        },
        symbol,
      });
      setRuns((existing) => [run, ...existing]);
      setCurrentRunId(run.id);
      setNotice("Agent workflow started. The risk engine controls every order.");
    });

  const stopCurrentRun = () =>
    currentRun &&
    perform("stop", async () => {
      const { run } = await qonyxApi.stopRun(currentRun.id, "Force stop pressed by user");
      setRuns((existing) => [run, ...existing.filter((item) => item.id !== run.id)]);
      if (run.lastError) {
        throw new Error(run.lastError);
      }
      setNotice("Agent stopped and the exchange confirmed the cancellation request.");
    });

  const runCycleNow = () =>
    currentRun &&
    perform("cycle", async () => {
      const { run } = await qonyxApi.runCycle(currentRun.id);
      setRuns((existing) => [run, ...existing.filter((item) => item.id !== run.id)]);
      setNotice("One complete analyst → trader → reporter cycle finished.");
    });

  const refreshCurrentRun = () =>
    currentRun &&
    perform("refresh-run", async () => {
      const { run } = await qonyxApi.getRun(currentRun.id);
      setRuns((existing) => [
        run,
        ...existing.filter((item) => item.id !== run.id),
      ]);
      setNotice(`Runtime log refreshed with ${run.events.length} event(s).`);
    });

  const emergencyStop = () =>
    perform("emergency", async () => {
      const result = await qonyxApi.emergencyStop();
      setSystemHalted(true);
      await refresh();
      if (result.cancellationFailures.length > 0) {
        setError(
          `Trading is locked, but ${result.cancellationFailures.length} run(s) require manual exchange cancellation.`,
        );
      } else {
        setNotice(
          `Emergency stop locked trading and stopped ${result.stoppedRuns.length} run(s).`,
        );
      }
    });

  const unlock = () =>
    perform("unlock", async () => {
      await qonyxApi.unlock();
      setSystemHalted(false);
      setNotice("Trading lock removed. Existing stopped runs remain stopped.");
    });

  return (
    <div className="view-stack agent-studio">
      <section className="agent-hero onyx-card">
        <div>
          <div className="inline-label violet">
            <Workflow size={16} />
            Segregated agent workflow
          </div>
          <h1>AI Trading Agent Studio</h1>
          <p>
            Configure three independent roles. AI proposes actions; Qonyx alone enforces
            the fund, position, order-size, loss, and emergency-stop limits.
          </p>
        </div>
        <div className="agent-hero-actions">
          <span className={`status-badge ${systemHalted ? "risk" : "active"}`}>
            {systemHalted ? "Trading locked" : "Risk gate online"}
          </span>
          <button
            className={systemHalted ? "btn btn-primary" : "btn btn-danger"}
            disabled={Boolean(busyAction)}
            type="button"
            onClick={systemHalted ? unlock : emergencyStop}
          >
            {busyAction === "emergency" || busyAction === "unlock" ? (
              <LoaderCircle className="spin" size={18} />
            ) : systemHalted ? (
              <Play size={18} />
            ) : (
              <Pause size={18} />
            )}
            {systemHalted ? "Unlock system" : "Force stop all"}
          </button>
        </div>
      </section>

      {error && (
        <div className="agent-message error-message" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="agent-message success-message">
          <ShieldCheck size={18} />
          <span>{notice}</span>
        </div>
      )}

      <section className="agent-layout">
        <div className="onyx-card agent-config-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Run configuration</p>
              <h2>Funds and execution</h2>
            </div>
            <Gauge size={22} />
          </div>

          <div className="agent-form-grid">
            <label className="field">
              <span>Environment</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as "paper" | "live")}
              >
                <option value="paper">Qonyx paper sandbox</option>
                <option value="live" disabled={!liveTradingEnabled}>
                  Live / exchange testnet
                </option>
              </select>
              {!liveTradingEnabled && <small>Live mode disabled by server policy.</small>}
            </label>
            <label className="field">
              <span>Market symbol</span>
              <input
                list="qonyx-market-suggestions"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              />
              <datalist id="qonyx-market-suggestions">
                <option value="BTC/USD" />
                <option value="BTC/USDT" />
                <option value="ETH/USD" />
                <option value="ETH/USDT" />
                <option value="SOL/USD" />
                <option value="SOL/USDT" />
                <option value="US.AAPL" />
              </datalist>
              <small>
                Use BTC/USD for crypto or the gateway's venue symbol, such as US.AAPL.
              </small>
            </label>
            {mode === "live" && (
              <label className="field agent-field-wide">
                <span>Exchange connection</span>
                <select
                  value={exchangeConnectionId}
                  onChange={(event) => setExchangeConnectionId(event.target.value)}
                >
                  <option value="">Choose a connection</option>
                  {exchangeConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.label} · {connection.platform}
                      {connection.sandbox ? " sandbox" : " live"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <NumberField
              icon={<CircleDollarSign size={15} />}
              label="Agent fund (USD)"
              min={100}
              value={capital}
              onChange={setCapital}
            />
            <NumberField
              label="Maximum order (USD)"
              min={5}
              value={maxOrder}
              onChange={setMaxOrder}
            />
            <NumberField
              label="Realized-loss stop for this run (USD)"
              min={5}
              value={dailyLoss}
              onChange={setDailyLoss}
            />
            <NumberField
              label="Max position (%)"
              max={100}
              min={1}
              value={maxPositionPercent}
              onChange={setMaxPositionPercent}
            />
            <NumberField
              label="Cycle interval (seconds)"
              min={5}
              value={cycleSeconds}
              onChange={setCycleSeconds}
            />
            <NumberField
              label="Stop after cycles (0 = continuous)"
              min={0}
              value={maxCycles}
              onChange={setMaxCycles}
            />
          </div>

          <div className="fund-invariant">
            <ShieldCheck size={20} />
            <div>
              <strong>Hard fund ceiling: {money.format(capital)}</strong>
              <p>
                Maximum position {money.format((capital * maxPositionPercent) / 100)};
                each order at most {money.format(Math.min(maxOrder, capital))}.
              </p>
            </div>
          </div>
        </div>

        <div className="onyx-card agent-launch-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Launch</p>
              <h2>Final gate</h2>
            </div>
            <Sparkles size={22} />
          </div>
          <div className="launch-checks">
            <span><i /> Paper mode is the default</span>
            <span><i /> Secrets stay in server memory</span>
            <span><i /> No leverage or short selling</span>
            <span><i /> Force stop requests open-order cancellation</span>
          </div>
          <button
            className="btn btn-primary full-width"
            disabled={Boolean(busyAction) || systemHalted || maxOrder > capital}
            type="button"
            onClick={startRun}
          >
            {busyAction === "start" ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Play size={18} />
            )}
            Start three-agent workflow
          </button>
          {maxOrder > capital && (
            <small className="inline-error">Maximum order cannot exceed the agent fund.</small>
          )}
        </div>
      </section>

      <section className="onyx-card agent-pipeline-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agent pipeline</p>
            <h2>Analysis → trade proposal → report</h2>
          </div>
          <span className="status-badge ai">Typed handoffs</span>
        </div>
        <div className="agent-pipeline">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <article key={role.key} className="agent-role-card">
                <div className="agent-role-icon"><Icon size={21} /></div>
                <div>
                  <span>{role.title}</span>
                  <strong>{role.name}</strong>
                </div>
                <p>{role.description}</p>
                <label className="field">
                  <span>AI provider</span>
                  <select
                    value={agentConnections[role.key]}
                    onChange={(event) =>
                      setAgentConnections((current) => ({
                        ...current,
                        [role.key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Built-in deterministic sandbox</option>
                    {aiConnections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.label} · {connection.model}
                      </option>
                    ))}
                  </select>
                </label>
                <small>{assignedProviderNames[role.key]}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="onyx-card live-run-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Runtime</p>
            <h2>{currentRun ? currentRun.config.name : "No agent run yet"}</h2>
          </div>
          {currentRun && (
            <span className={`status-badge ${statusTone(currentRun.status)}`}>
              {currentRun.status}
            </span>
          )}
        </div>
        {!currentRun ? (
          <div className="agent-empty">
            <Workflow size={26} />
            <p>Start a paper workflow to see agent handoffs, risk decisions, and reports.</p>
          </div>
        ) : (
          <>
            <div className="runtime-metrics">
              <Metric label="Cycles" value={String(currentRun.cycles.length)} />
              <Metric
                label="Fund ceiling"
                value={money.format(currentRun.config.risk.capitalLimitUsd)}
              />
              <Metric
                label="Exposure"
                value={money.format(latestCycle?.accountAfter.exposureUsd || 0)}
              />
              <Metric
                label="Realized PnL"
                value={money.format(latestCycle?.accountAfter.realizedPnlUsd || 0)}
              />
            </div>
            <div className="run-actions">
              <button
                className="btn btn-secondary"
                disabled={Boolean(busyAction) || currentRun.status !== "running"}
                type="button"
                onClick={runCycleNow}
              >
                {busyAction === "cycle" ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <RefreshCw size={18} />
                )}
                Run one cycle now
              </button>
              <button
                className="btn btn-danger"
                disabled={
                  Boolean(busyAction) ||
                  (currentRun.status !== "running" &&
                    !currentRun.lastError?.includes("manual exchange cancellation"))
                }
                type="button"
                onClick={stopCurrentRun}
              >
                <Pause size={18} />
                Force stop agent
              </button>
            </div>
            {currentRun.lastError && (
              <div className="agent-message error-message">
                <AlertTriangle size={18} />
                <span>{currentRun.lastError}</span>
              </div>
            )}
            <RunActivityLog
              isRefreshing={busyAction === "refresh-run"}
              run={currentRun}
              onRefresh={refreshCurrentRun}
            />
            {latestCycle && (
              <div className="cycle-grid">
                <div className="cycle-steps">
                  {latestCycle.steps.map((step) => (
                    <div key={`${latestCycle.id}-${step.role}`} className="cycle-step">
                      <span className={step.status} />
                      <div>
                        <strong>{step.name}</strong>
                        <p>{step.role} · {step.status}</p>
                      </div>
                    </div>
                  ))}
                  <div className="risk-decision">
                    <ShieldCheck size={18} />
                    <div>
                      <strong>
                        Risk gate {latestCycle.risk.approved ? "approved" : "blocked"} the intent
                      </strong>
                      <p>
                        {latestCycle.risk.violations.join(" ") ||
                          "No limit adjustment was required."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="cycle-report">
                  <span>Cycle {latestCycle.sequence} report</span>
                  <h3>{latestCycle.report.headline}</h3>
                  <p>{latestCycle.report.narrative}</p>
                  <div>
                    <strong>{latestCycle.report.action}</strong>
                    <small>{latestCycle.report.budgetSummary}</small>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function NumberField({
  icon,
  label,
  max,
  min,
  onChange,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  max?: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="field">
      <span>{icon}{label}</span>
      <input
        max={max}
        min={min}
        step="any"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bot-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
