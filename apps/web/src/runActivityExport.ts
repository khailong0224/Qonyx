import type { AgentRun } from "./services/qonyxApi";

export function buildRunActivityExport(
  run: AgentRun,
  exportedAt = new Date().toISOString(),
) {
  return {
    events: run.events,
    exportedAt,
    run: {
      id: run.id,
      mode: run.config.mode,
      name: run.config.name,
      platform: run.config.platform,
      status: run.status,
      symbol: run.config.symbol,
    },
  };
}

export function runActivityFileName(runName: string) {
  const safeName =
    runName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "qonyx-run";
  return `${safeName}-activity.json`;
}
