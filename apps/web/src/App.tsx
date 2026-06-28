import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
  CircleDollarSign,
  Command,
  Gauge,
  Layers3,
  LineChart,
  LockKeyhole,
  Menu,
  Pause,
  Play,
  PlugZap,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

type View = "dashboard" | "strategy" | "research" | "risk" | "exchange";
type BadgeVariant = "active" | "paused" | "risk" | "paper" | "ai" | "neutral";

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Command", icon: BarChart3 },
  { id: "strategy", label: "Strategy Lab", icon: Layers3 },
  { id: "research", label: "AI Research", icon: BrainCircuit },
  { id: "risk", label: "Risk Center", icon: ShieldAlert },
  { id: "exchange", label: "Exchanges", icon: PlugZap },
];

const metrics = [
  {
    label: "Portfolio Value",
    value: "$284,912",
    trend: "+4.2%",
    tone: "profit",
    icon: Wallet,
  },
  {
    label: "Daily PnL",
    value: "+$8,431",
    trend: "+2.9%",
    tone: "profit",
    icon: TrendingUp,
  },
  {
    label: "Active Strategies",
    value: "12",
    trend: "8 live",
    tone: "info",
    icon: Activity,
  },
  {
    label: "Max Drawdown",
    value: "3.8%",
    trend: "-0.6%",
    tone: "warning",
    icon: TrendingDown,
  },
];

const strategies = [
  {
    name: "Onyx Momentum",
    market: "BTC/USDT",
    pnl: "+$3,214",
    winRate: "68%",
    status: "Active",
    risk: "Low",
  },
  {
    name: "Mean Revert Alpha",
    market: "ETH/USDT",
    pnl: "+$1,904",
    winRate: "61%",
    status: "Paper",
    risk: "Medium",
  },
  {
    name: "Volatility Guard",
    market: "SOL/USDT",
    pnl: "-$284",
    winRate: "54%",
    status: "Paused",
    risk: "Guarded",
  },
];

const insightCards = [
  {
    title: "Liquidity Sweep Detected",
    body: "BTC order flow shows a shallow sell-side sweep with recovery above VWAP.",
    confidence: "87%",
    variant: "ai" as const,
  },
  {
    title: "Risk Compression",
    body: "Portfolio exposure is clustered in high-beta pairs. Suggested cap: 22%.",
    confidence: "74%",
    variant: "risk" as const,
  },
];

const chartPoints = [18, 22, 21, 30, 28, 36, 33, 44, 41, 52, 49, 61];

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [paperMode, setPaperMode] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [tradingLocked, setTradingLocked] = useState(false);

  const activeTitle = useMemo(
    () => navItems.find((item) => item.id === activeView)?.label ?? "Command",
    [activeView],
  );

  return (
    <div className="app-shell">
      <AppSidebar
        activeView={activeView}
        onSelect={(view) => {
          setActiveView(view);
          setMobileNavOpen(false);
        }}
        mobileNavOpen={mobileNavOpen}
      />
      <div className="app-main">
        <AppHeader
          activeTitle={activeTitle}
          paperMode={paperMode}
          onPaperModeChange={setPaperMode}
          onOpenNav={() => setMobileNavOpen(true)}
        />
        <main className="content-shell">
          {activeView === "dashboard" && (
            <DashboardView
              paperMode={paperMode}
              tradingLocked={tradingLocked}
              onOpenResearch={() => setActiveView("research")}
              onOpenRisk={() => setActiveView("risk")}
              onConfirmKill={() => setKillConfirmOpen(true)}
            />
          )}
          {activeView === "strategy" && <StrategyLabView />}
          {activeView === "research" && <AIResearchView />}
          {activeView === "risk" && (
            <RiskCenterView
              tradingLocked={tradingLocked}
              onConfirmKill={() => setKillConfirmOpen(true)}
            />
          )}
          {activeView === "exchange" && <ExchangeView />}
        </main>
      </div>
      <ConfirmModal
        open={killConfirmOpen}
        title="Lock all automated trading?"
        description="Qonyx will pause every live strategy, cancel pending orders, and keep paper trading available for review."
        confirmLabel={tradingLocked ? "Unlock Trading" : "Lock Trading"}
        danger={!tradingLocked}
        onCancel={() => setKillConfirmOpen(false)}
        onConfirm={() => {
          setTradingLocked((current) => !current);
          setKillConfirmOpen(false);
        }}
      />
    </div>
  );
}

function DashboardView({
  paperMode,
  tradingLocked,
  onOpenResearch,
  onOpenRisk,
  onConfirmKill,
}: {
  paperMode: boolean;
  tradingLocked: boolean;
  onOpenResearch: () => void;
  onOpenRisk: () => void;
  onConfirmKill: () => void;
}) {
  return (
    <div className="view-stack">
      <OnboardingPanel
        paperMode={paperMode}
        tradingLocked={tradingLocked}
        onOpenResearch={onOpenResearch}
        onOpenRisk={onOpenRisk}
      />
      <section className="metric-grid" aria-label="Trading metrics">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <section className="dashboard-grid">
        <ChartCard />
        <OnyxCard className="strategy-table-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Strategies</p>
              <h2>Live Strategy Stack</h2>
            </div>
            <StatusBadge variant={tradingLocked ? "risk" : "active"}>
              {tradingLocked ? "Locked" : "Running"}
            </StatusBadge>
          </div>
          <StrategyTable />
        </OnyxCard>
      </section>
      <section className="lower-grid">
        <AIInsightPanel onOpenResearch={onOpenResearch} />
        <RiskSnapshotPanel
          tradingLocked={tradingLocked}
          onOpenRisk={onOpenRisk}
          onConfirmKill={onConfirmKill}
        />
      </section>
    </div>
  );
}

function OnboardingPanel({
  paperMode,
  tradingLocked,
  onOpenResearch,
  onOpenRisk,
}: {
  paperMode: boolean;
  tradingLocked: boolean;
  onOpenResearch: () => void;
  onOpenRisk: () => void;
}) {
  return (
    <OnyxCard className="onboarding-panel reflective">
      <div className="onboarding-copy">
        <div className="inline-label">
          <Sparkles size={16} />
          Onyx Terminal
        </div>
        <h1>Qonyx Command Center</h1>
        <p>
          Monitor automated strategies, AI market signals, and risk controls in
          one polished trading workspace.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={onOpenResearch}>
            <BrainCircuit size={18} />
            Run AI Brief
          </button>
          <button className="btn btn-secondary" type="button" onClick={onOpenRisk}>
            <ShieldAlert size={18} />
            Review Risk
          </button>
        </div>
      </div>
      <div className="onboarding-status" aria-label="Onboarding status">
        <QonyxMascot className="mascot-hero" />
        <div className="status-row">
          <StatusBadge variant={paperMode ? "paper" : "active"}>
            {paperMode ? "Paper Trading" : "Live Mode"}
          </StatusBadge>
          <StatusBadge variant={tradingLocked ? "risk" : "active"}>
            {tradingLocked ? "Risk Locked" : "Risk Clear"}
          </StatusBadge>
        </div>
      </div>
    </OnyxCard>
  );
}

function StrategyLabView() {
  return (
    <div className="view-stack">
      <section className="lab-grid">
        <OnyxCard className="builder-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Strategy Lab</p>
              <h2>Momentum Builder</h2>
            </div>
            <StatusBadge variant="paper">Paper Ready</StatusBadge>
          </div>
          <div className="control-grid">
            <Field label="Market" value="BTC/USDT" />
            <Field label="Signal" value="VWAP Reclaim" />
            <Field label="Max Position" value="14%" />
            <Field label="Stop Loss" value="2.4%" />
          </div>
          <div className="segmented" role="tablist" aria-label="Risk profile">
            <button className="active" type="button">
              Conservative
            </button>
            <button type="button">Balanced</button>
            <button type="button">Aggressive</button>
          </div>
          <button className="btn btn-primary full-width" type="button">
            <Play size={18} />
            Start Paper Backtest
          </button>
        </OnyxCard>
        <EmptyState
          title="Create your first Qonyx strategy"
          body="Set a market, define a signal, and let Qonyx simulate risk before anything goes live."
          actionLabel="Build Strategy"
          icon={Layers3}
        />
      </section>
      <OnyxCard>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Backtest</p>
            <h2>Recent Result</h2>
          </div>
          <StatusBadge variant="neutral">No result yet</StatusBadge>
        </div>
        <LoadingSkeleton rows={4} />
      </OnyxCard>
    </div>
  );
}

function AIResearchView() {
  return (
    <div className="view-stack">
      <OnyxCard className="research-welcome">
        <QonyxMascot className="mascot-research" />
        <div>
          <div className="inline-label violet">
            <Bot size={16} />
            Qonyx AI
          </div>
          <h1>AI Market Brief</h1>
          <p>
            The assistant is ready to summarize momentum, liquidity, and risk
            conditions before a strategy is deployed.
          </p>
        </div>
      </OnyxCard>
      <section className="research-grid">
        {insightCards.map((insight) => (
          <OnyxCard key={insight.title} className="insight-card">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">{insight.variant === "ai" ? "Signal" : "Guardrail"}</p>
                <h2>{insight.title}</h2>
              </div>
              <StatusBadge variant={insight.variant}>{insight.confidence}</StatusBadge>
            </div>
            <p>{insight.body}</p>
          </OnyxCard>
        ))}
      </section>
      <OnyxCard className="prompt-panel">
        <div className="prompt-input">
          <Bot size={20} />
          <span>Analyze BTC and ETH for the next session.</span>
        </div>
        <button className="btn btn-primary" type="button">
          <Zap size={18} />
          Generate Brief
        </button>
      </OnyxCard>
    </div>
  );
}

function RiskCenterView({
  tradingLocked,
  onConfirmKill,
}: {
  tradingLocked: boolean;
  onConfirmKill: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="risk-grid">
        <OnyxCard className="risk-command">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Risk Center</p>
              <h2>Portfolio Guardrails</h2>
            </div>
            <RiskBadge locked={tradingLocked} />
          </div>
          <div className="risk-meter">
            <div>
              <span>Exposure</span>
              <strong>42%</strong>
            </div>
            <div className="meter-track">
              <span style={{ width: "42%" }} />
            </div>
          </div>
          <div className="risk-list">
            <RiskItem label="Max daily loss" value="1.6% / 5.0%" tone="safe" />
            <RiskItem label="Leverage cap" value="1.8x / 3.0x" tone="safe" />
            <RiskItem label="Correlation cluster" value="Elevated" tone="warn" />
          </div>
        </OnyxCard>
        <OnyxCard className="kill-card">
          <div className="danger-mark">
            <ShieldAlert size={28} />
          </div>
          <h2>{tradingLocked ? "Trading is locked" : "Emergency Kill Switch"}</h2>
          <p>
            {tradingLocked
              ? "Automated orders are paused until the lock is removed."
              : "Pause live automation and cancel pending orders across connected venues."}
          </p>
          <KillSwitchButton locked={tradingLocked} onClick={onConfirmKill} />
        </OnyxCard>
      </section>
    </div>
  );
}

function ExchangeView() {
  return (
    <div className="view-stack">
      <section className="exchange-grid">
        <EmptyState
          title="No exchange connected"
          body="Connect a paper account first, then add live venues after risk controls are configured."
          actionLabel="Connect Exchange"
          icon={PlugZap}
        />
        <OnyxCard>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Connection Checklist</p>
              <h2>Launch Readiness</h2>
            </div>
            <StatusBadge variant="paused">Pending</StatusBadge>
          </div>
          <Checklist />
        </OnyxCard>
      </section>
    </div>
  );
}

function AppSidebar({
  activeView,
  onSelect,
  mobileNavOpen,
}: {
  activeView: View;
  onSelect: (view: View) => void;
  mobileNavOpen: boolean;
}) {
  return (
    <>
      <aside className={cn("sidebar", mobileNavOpen && "open")}>
        <div className="brand-lockup">
          <QonyxLogoIcon />
          <div>
            <strong>Qonyx</strong>
            <span>Onyx Terminal</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn("nav-item", activeView === item.id && "active")}
                type="button"
                title={item.label}
                onClick={() => onSelect(item.id)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="mini-terminal">
            <Command size={18} />
            <div>
              <span>Signal Engine</span>
              <strong>Online</strong>
            </div>
          </div>
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          className="nav-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => onSelect(activeView)}
        />
      )}
    </>
  );
}

function AppHeader({
  activeTitle,
  paperMode,
  onPaperModeChange,
  onOpenNav,
}: {
  activeTitle: string;
  paperMode: boolean;
  onPaperModeChange: (enabled: boolean) => void;
  onOpenNav: () => void;
}) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" type="button" title="Open menu" onClick={onOpenNav}>
        <Menu size={20} />
      </button>
      <div className="topbar-title">
        <span>Qonyx</span>
        <h2>{activeTitle}</h2>
      </div>
      <label className="search-field">
        <Search size={18} />
        <input aria-label="Search Qonyx" placeholder="Search markets, strategies, signals" />
      </label>
      <label className="mode-toggle">
        <input
          type="checkbox"
          checked={paperMode}
          onChange={(event) => onPaperModeChange(event.target.checked)}
        />
        <span />
        Paper
      </label>
      <button className="btn btn-secondary compact-button" type="button">
        <CircleDollarSign size={18} />
        Fund
      </button>
    </header>
  );
}

function OnyxCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("onyx-card", className)}>{children}</div>;
}

function MetricCard({
  label,
  value,
  trend,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend: string;
  tone: string;
  icon: LucideIcon;
}) {
  return (
    <OnyxCard className="metric-card">
      <div className={cn("metric-icon", tone)}>
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong className="tabular-nums">{value}</strong>
      <em className={cn("metric-trend", tone)}>{trend}</em>
    </OnyxCard>
  );
}

function ChartCard() {
  const [window, setWindow] = useState("1D");
  const path = chartPoints
    .map((point, index) => {
      const x = (index / (chartPoints.length - 1)) * 100;
      const y = 78 - point;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <OnyxCard className="chart-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Market Terminal</p>
          <h2>BTC Momentum Flow</h2>
        </div>
        <div className="chart-actions">
          {["1D", "1W", "1M"].map((range) => (
            <button
              key={range}
              className={window === range ? "active" : ""}
              type="button"
              onClick={() => setWindow(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <div className="price-row">
        <strong className="tabular-nums">$68,421.40</strong>
        <StatusBadge variant="active">+2.8%</StatusBadge>
      </div>
      <svg className="market-chart" viewBox="0 0 100 80" role="img" aria-label="BTC momentum chart">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(45, 212, 191, 0.34)" />
            <stop offset="100%" stopColor="rgba(45, 212, 191, 0)" />
          </linearGradient>
        </defs>
        <path d={`${path} L 100 80 L 0 80 Z`} fill="url(#chartFill)" />
        <path d={path} fill="none" stroke="#2DD4BF" strokeLinecap="round" strokeWidth="2.4" />
        {chartPoints.slice(4, 10).map((point, index) => {
          const x = ((index + 4) / (chartPoints.length - 1)) * 100;
          return (
            <line
              key={`${point}-${index}`}
              x1={x}
              x2={x}
              y1={78 - point - 8}
              y2={78 - point + 7}
              stroke={index % 2 === 0 ? "#22C55E" : "#F43F5E"}
              strokeLinecap="round"
              strokeWidth="1.8"
              opacity="0.8"
            />
          );
        })}
      </svg>
    </OnyxCard>
  );
}

function StrategyTable() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Market</th>
            <th>PnL</th>
            <th>Win</th>
            <th>Status</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((strategy) => (
            <tr key={strategy.name}>
              <td>{strategy.name}</td>
              <td className="mono">{strategy.market}</td>
              <td className={strategy.pnl.startsWith("+") ? "profit" : "loss"}>{strategy.pnl}</td>
              <td>{strategy.winRate}</td>
              <td>
                <StatusBadge
                  variant={
                    strategy.status === "Active"
                      ? "active"
                      : strategy.status === "Paper"
                        ? "paper"
                        : "paused"
                  }
                >
                  {strategy.status}
                </StatusBadge>
              </td>
              <td>{strategy.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AIInsightPanel({ onOpenResearch }: { onOpenResearch: () => void }) {
  return (
    <OnyxCard className="ai-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AI Research</p>
          <h2>Signal Summary</h2>
        </div>
        <StatusBadge variant="ai">Live</StatusBadge>
      </div>
      <p>
        Qonyx sees sustained momentum with elevated correlation risk. Reduce
        duplicate long exposure before adding new BTC entries.
      </p>
      <button className="btn btn-secondary" type="button" onClick={onOpenResearch}>
        <Bot size={18} />
        Open Research
      </button>
    </OnyxCard>
  );
}

function RiskSnapshotPanel({
  tradingLocked,
  onOpenRisk,
  onConfirmKill,
}: {
  tradingLocked: boolean;
  onOpenRisk: () => void;
  onConfirmKill: () => void;
}) {
  return (
    <OnyxCard className="risk-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Risk</p>
          <h2>Guard Status</h2>
        </div>
        <RiskBadge locked={tradingLocked} />
      </div>
      <div className="risk-actions">
        <button className="btn btn-secondary" type="button" onClick={onOpenRisk}>
          <Gauge size={18} />
          Open Center
        </button>
        <KillSwitchButton locked={tradingLocked} onClick={onConfirmKill} compact />
      </div>
    </OnyxCard>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  icon: Icon,
}: {
  title: string;
  body: string;
  actionLabel: string;
  icon: LucideIcon;
}) {
  return (
    <OnyxCard className="empty-state">
      <QonyxMascot className="mascot-empty" />
      <div className="empty-copy">
        <div className="empty-icon">
          <Icon size={18} />
        </div>
        <h2>{title}</h2>
        <p>{body}</p>
        <button className="btn btn-primary" type="button">
          <Sparkles size={18} />
          {actionLabel}
        </button>
      </div>
    </OnyxCard>
  );
}

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="skeleton-stack" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} className="skeleton-row" />
      ))}
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal-card onyx-card">
        <button className="icon-button modal-close" type="button" title="Close" onClick={onCancel}>
          <X size={18} />
        </button>
        <div className={cn("modal-icon", danger && "danger")}>
          {danger ? <ShieldAlert size={24} /> : <LockKeyhole size={24} />}
        </div>
        <h2 id="confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={cn("btn", danger ? "btn-danger" : "btn-primary")}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function KillSwitchButton({
  locked,
  compact,
  onClick,
}: {
  locked: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn("btn", locked ? "btn-secondary" : "btn-danger", compact && "compact-button")}
      type="button"
      onClick={onClick}
    >
      {locked ? <Play size={18} /> : <Pause size={18} />}
      {locked ? "Unlock" : "Kill Switch"}
    </button>
  );
}

function StatusBadge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  return <span className={cn("status-badge", variant)}>{children}</span>;
}

function RiskBadge({ locked }: { locked: boolean }) {
  return <StatusBadge variant={locked ? "risk" : "active"}>{locked ? "Blocked" : "Clear"}</StatusBadge>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <button type="button">
        {value}
        <ChevronDown size={16} />
      </button>
    </label>
  );
}

function RiskItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "safe" | "warn";
}) {
  return (
    <div className="risk-item">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function Checklist() {
  const items = [
    ["Paper keys added", true],
    ["Risk limits reviewed", true],
    ["Live venue connected", false],
    ["Strategy promoted", false],
  ] as const;

  return (
    <div className="checklist">
      {items.map(([label, complete]) => (
        <div key={label} className="check-row">
          <span className={complete ? "complete" : ""} />
          <p>{label}</p>
        </div>
      ))}
    </div>
  );
}

function QonyxLogoIcon({ className }: { className?: string }) {
  return (
    <img
      className={cn("qonyx-logo", className)}
      src="/brand/qonyx-logo-icon.png"
      alt="Qonyx logo"
      width="44"
      height="44"
    />
  );
}

function QonyxMascot({ className }: { className?: string }) {
  return (
    <img
      className={cn("qonyx-mascot", className)}
      src="/brand/qonyx-mascot.png"
      alt="Qonyx mascot"
      width="220"
      height="220"
    />
  );
}
