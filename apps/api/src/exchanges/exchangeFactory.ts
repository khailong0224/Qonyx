import type {
  AgentRunConfig,
  ExchangeAdapter,
  ExchangeConnectionSecret,
  PlatformCapability,
} from "../domain.js";
import type { ServerConfig } from "../config.js";
import type { CredentialVault } from "../services/credentialVault.js";
import { CcxtExchangeAdapter } from "./ccxtExchange.js";
import { FundCappedExchangeAdapter } from "./fundCappedExchange.js";
import { HttpGatewayExchangeAdapter } from "./httpGatewayExchange.js";
import { PaperExchangeAdapter } from "./paperExchange.js";

export const platformCapabilities: PlatformCapability[] = [
  {
    id: "paper",
    label: "Qonyx Paper",
    liveTrading: false,
    note: "Local paper fills with no credentials. Recommended for all first runs.",
    sandbox: true,
  },
  {
    id: "binance",
    label: "Binance",
    liveTrading: true,
    note: "CCXT spot adapter with exchange sandbox support where the account allows it.",
    sandbox: true,
  },
  {
    id: "bitget",
    label: "Bitget",
    liveTrading: true,
    note: "CCXT spot adapter. API key, secret, and passphrase are required.",
    sandbox: true,
  },
  {
    id: "bybit",
    label: "Bybit",
    liveTrading: true,
    note: "CCXT spot adapter with testnet support.",
    sandbox: true,
  },
  {
    id: "moomoo",
    label: "Moomoo / Futu OpenD",
    liveTrading: true,
    note: "Connect through a local Qonyx-compatible OpenD HTTP bridge.",
    sandbox: true,
  },
  {
    id: "webhook",
    label: "Custom Webhook",
    liveTrading: true,
    note: "Connect another venue through the documented Qonyx exchange-gateway contract.",
    sandbox: true,
  },
];

export class ExchangeFactory {
  readonly #config: ServerConfig;
  readonly #vault: CredentialVault;

  constructor(config: ServerConfig, vault: CredentialVault) {
    this.#config = config;
    this.#vault = vault;
  }

  createForRun(run: AgentRunConfig): ExchangeAdapter {
    if (run.mode === "paper" || run.platform === "paper") {
      return new PaperExchangeAdapter(run.risk.capitalLimitUsd);
    }

    if (!this.#config.enableLiveTrading) {
      throw new Error(
        "Live trading is disabled. Keep paper mode on or set QONYX_ENABLE_LIVE_TRADING=true after sandbox validation.",
      );
    }

    if (!run.exchangeConnectionId) {
      throw new Error("A live run requires an exchange connection.");
    }

    const secret = this.#vault.getExchange(run.exchangeConnectionId);
    if (!secret || secret.platform !== run.platform) {
      throw new Error(`A matching ${run.platform} exchange connection was not found.`);
    }

    if (!secret.sandbox && !this.#config.allowMainnetTrading) {
      throw new Error(
        "Mainnet trading is disabled. Use a sandbox connection or explicitly set QONYX_ALLOW_MAINNET_TRADING=true after testnet validation.",
      );
    }

    return new FundCappedExchangeAdapter(
      this.createFromSecret(secret),
      run.risk.capitalLimitUsd,
    );
  }

  createFromSecret(secret: ExchangeConnectionSecret): ExchangeAdapter {
    if (secret.platform === "paper") {
      return new PaperExchangeAdapter(100_000);
    }
    if (
      secret.platform === "binance" ||
      secret.platform === "bitget" ||
      secret.platform === "bybit"
    ) {
      return new CcxtExchangeAdapter(
        secret as ExchangeConnectionSecret & {
          platform: "binance" | "bitget" | "bybit";
        },
      );
    }
    return new HttpGatewayExchangeAdapter(
      secret as ExchangeConnectionSecret & { platform: "moomoo" | "webhook" },
    );
  }
}
