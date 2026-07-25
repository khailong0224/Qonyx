function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

export type ServerConfig = {
  allowMainnetTrading: boolean;
  enableLiveTrading: boolean;
  host: string;
  port: number;
  sessionToken?: string;
};

export function loadServerConfig(): ServerConfig {
  return {
    allowMainnetTrading: parseBoolean(process.env.QONYX_ALLOW_MAINNET_TRADING, false),
    enableLiveTrading: parseBoolean(process.env.QONYX_ENABLE_LIVE_TRADING, false),
    host: process.env.QONYX_API_HOST?.trim() || "127.0.0.1",
    port: parsePort(process.env.QONYX_API_PORT, 8_787),
    sessionToken: process.env.QONYX_SESSION_TOKEN?.trim() || undefined,
  };
}
