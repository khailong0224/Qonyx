import type { MarketSnapshot } from "../domain.js";

export interface MarketDataSource {
  getSnapshot(symbol: string, signal?: AbortSignal): Promise<MarketSnapshot>;
}

const fallbackPrices: Record<string, number> = {
  "BTC/USD": 118_000,
  "BTC/USDT": 118_000,
  "ETH/USD": 3_700,
  "ETH/USDT": 3_700,
  "SOL/USD": 185,
  "SOL/USDT": 185,
};

function fallbackPrice(symbol: string) {
  return fallbackPrices[symbol] ?? 100;
}

export class SyntheticMarketDataSource implements MarketDataSource {
  #tick = 0;
  readonly #basePrice: number;

  constructor(basePrice?: number) {
    this.#basePrice = basePrice ?? 118_000;
  }

  async getSnapshot(symbol: string): Promise<MarketSnapshot> {
    this.#tick += 1;
    const base = fallbackPrices[symbol] ?? this.#basePrice;
    const drift = Math.sin(this.#tick / 2.7) * 0.006 + this.#tick * 0.00035;
    const price = base * (1 + drift);
    return {
      ask: price * 1.0002,
      bid: price * 0.9998,
      changePercent24h: drift * 100,
      price,
      symbol,
      timestamp: new Date().toISOString(),
      volume24h: 24_000 + this.#tick * 113,
    };
  }
}

export class CoinbaseMarketDataSource implements MarketDataSource {
  async getSnapshot(symbol: string, signal?: AbortSignal): Promise<MarketSnapshot> {
    const [base, quote] = symbol.split("/");
    const product = `${base}-${quote === "USDT" ? "USD" : quote}`;
    const response = await fetch(`https://api.exchange.coinbase.com/products/${product}/stats`, {
      headers: { Accept: "application/json" },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(3_000)])
        : AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      throw new Error(`Coinbase market data returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as {
      high?: string;
      last?: string;
      low?: string;
      open?: string;
      volume?: string;
    };
    const price = Number(payload.last);
    const open = Number(payload.open);

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Coinbase returned an invalid market price.");
    }

    return {
      ask: price * 1.0002,
      bid: price * 0.9998,
      changePercent24h: Number.isFinite(open) && open > 0 ? ((price - open) / open) * 100 : 0,
      price,
      symbol,
      timestamp: new Date().toISOString(),
      volume24h: Number(payload.volume) || 0,
    };
  }
}

export class ResilientMarketDataSource implements MarketDataSource {
  readonly #fallback: MarketDataSource;
  readonly #primary: MarketDataSource;

  constructor(
    primary: MarketDataSource = new CoinbaseMarketDataSource(),
    fallback: MarketDataSource = new SyntheticMarketDataSource(),
  ) {
    this.#primary = primary;
    this.#fallback = fallback;
  }

  async getSnapshot(symbol: string, signal?: AbortSignal) {
    try {
      return await this.#primary.getSnapshot(symbol, signal);
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }

      const snapshot = await this.#fallback.getSnapshot(symbol, signal);
      return {
        ...snapshot,
        price: snapshot.price || fallbackPrice(symbol),
      };
    }
  }
}
