import { Activity, Download, ListFilter, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildRunActivityExport,
  runActivityFileName,
} from "./runActivityExport";
import type { AgentRun, RunEvent } from "./services/qonyxApi";

type EventFilter = "all" | "errors" | RunEvent["category"];

type RunActivityLogProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
  run: AgentRun;
};

const eventFilters: Array<{ label: string; value: EventFilter }> = [
  { label: "All events", value: "all" },
  { label: "Run lifecycle", value: "run" },
  { label: "Agents", value: "agent" },
  { label: "Risk", value: "risk" },
  { label: "Orders", value: "order" },
  { label: "System", value: "system" },
  { label: "Warnings & errors", value: "errors" },
];

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${durationMs} ms`;
  }
  return `${(durationMs / 1_000).toFixed(2)} s`;
}

function exportEvents(run: AgentRun) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(buildRunActivityExport(run), null, 2)], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.download = runActivityFileName(run.config.name);
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function RunActivityLog({
  isRefreshing,
  onRefresh,
  run,
}: RunActivityLogProps) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const visibleEvents = useMemo(() => {
    const newestFirst = [...run.events].reverse();
    if (filter === "all") {
      return newestFirst;
    }
    if (filter === "errors") {
      return newestFirst.filter((event) => event.level !== "info");
    }
    return newestFirst.filter((event) => event.category === filter);
  }, [filter, run.events]);

  return (
    <section className="runtime-log" aria-labelledby="runtime-log-title">
      <div className="runtime-log-heading">
        <div>
          <span className="runtime-log-kicker">
            <Activity size={15} />
            Live activity
          </span>
          <h3 id="runtime-log-title">Runtime activity log</h3>
          <p>
            Structured agent, risk, order, and lifecycle events for this run.
          </p>
        </div>
        <div className="runtime-log-actions">
          <button
            className="btn btn-secondary btn-compact"
            disabled={isRefreshing}
            type="button"
            onClick={onRefresh}
          >
            <RefreshCw className={isRefreshing ? "spin" : undefined} size={16} />
            Refresh
          </button>
          <button
            className="btn btn-secondary btn-compact"
            disabled={run.events.length === 0}
            type="button"
            onClick={() => exportEvents(run)}
          >
            <Download size={16} />
            Export JSON
          </button>
        </div>
      </div>

      <div className="runtime-log-toolbar">
        <label>
          <ListFilter size={15} />
          <span>Filter</span>
          <select
            aria-label="Filter runtime events"
            value={filter}
            onChange={(event) => setFilter(event.target.value as EventFilter)}
          >
            {eventFilters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span>
          Showing {visibleEvents.length} of {run.events.length} recent events
        </span>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="runtime-log-empty">
          No events match this filter yet. Refresh after the next cycle.
        </div>
      ) : (
        <ol className="runtime-event-list" aria-live="polite">
          {visibleEvents.map((event) => (
            <li
              key={event.id}
              className={`runtime-event runtime-event-${event.level}`}
            >
              <span className="runtime-event-marker" aria-hidden="true" />
              <div className="runtime-event-content">
                <div className="runtime-event-primary">
                  <strong>{event.message}</strong>
                  <time dateTime={event.timestamp} title={event.timestamp}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </time>
                </div>
                <div className="runtime-event-meta">
                  <span>{event.category}</span>
                  {event.role && <span>{event.role}</span>}
                  {event.cycleSequence && (
                    <span>cycle {event.cycleSequence}</span>
                  )}
                  {event.durationMs !== undefined && (
                    <span>{formatDuration(event.durationMs)}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
