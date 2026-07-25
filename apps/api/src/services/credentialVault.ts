import { randomUUID } from "node:crypto";
import type {
  AiConnectionSecret,
  ConnectionSummary,
  ExchangeConnectionSecret,
} from "../domain.js";

type StoredConnection =
  | {
      createdAt: string;
      id: string;
      kind: "ai";
      label: string;
      secret: AiConnectionSecret;
    }
  | {
      createdAt: string;
      id: string;
      kind: "exchange";
      label: string;
      secret: ExchangeConnectionSecret;
    };

function lastFour(value: string | undefined) {
  return value ? value.slice(-4) : undefined;
}

function summarize(record: StoredConnection): ConnectionSummary {
  if (record.kind === "ai") {
    return {
      baseUrl: record.secret.baseUrl,
      createdAt: record.createdAt,
      id: record.id,
      kind: record.kind,
      label: record.label,
      model: record.secret.model,
      provider: record.secret.provider,
      secretLast4: lastFour(record.secret.apiKey),
    };
  }

  return {
    baseUrl: record.secret.baseUrl,
    createdAt: record.createdAt,
    id: record.id,
    kind: record.kind,
    label: record.label,
    platform: record.secret.platform,
    sandbox: record.secret.sandbox,
    secretLast4: lastFour(record.secret.apiKey),
  };
}

export class CredentialVault {
  readonly #records = new Map<string, StoredConnection>();

  delete(id: string) {
    return this.#records.delete(id);
  }

  getAi(id: string) {
    const record = this.#records.get(id);
    return record?.kind === "ai" ? record.secret : undefined;
  }

  getExchange(id: string) {
    const record = this.#records.get(id);
    return record?.kind === "exchange" ? record.secret : undefined;
  }

  list() {
    return [...this.#records.values()].map(summarize);
  }

  putAi(label: string, secret: AiConnectionSecret) {
    const record: StoredConnection = {
      createdAt: new Date().toISOString(),
      id: randomUUID(),
      kind: "ai",
      label,
      secret: { ...secret },
    };
    this.#records.set(record.id, record);
    return summarize(record);
  }

  putExchange(label: string, secret: ExchangeConnectionSecret) {
    const record: StoredConnection = {
      createdAt: new Date().toISOString(),
      id: randomUUID(),
      kind: "exchange",
      label,
      secret: { ...secret },
    };
    this.#records.set(record.id, record);
    return summarize(record);
  }
}
