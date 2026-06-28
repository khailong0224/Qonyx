export type MarketProduct =
  | "BTC-USD"
  | "ETH-USD"
  | "SOL-USD"
  | "XRP-USD"
  | "DOGE-USD"
  | "ADA-USD"
  | "AVAX-USD"
  | "LINK-USD";

export type MarketCandle = {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
};

export type TickerResponse = {
  price?: string;
  time?: string;
};

type CoinbaseCandlePayload = [number, number, number, number, number, number];

type MarketRequestContext = {
  endpoint: string;
  product: MarketProduct;
};

export type CandleRequest = {
  durationMs: number;
  granularity: number;
  product: MarketProduct;
  signal?: AbortSignal;
};

export type MarketSnapshot = {
  candles: MarketCandle[];
  requestedAt: Date;
  ticker: TickerResponse;
};

const COINBASE_EXCHANGE_BASE_URL = "https://api.exchange.coinbase.com";

export class MarketDataError extends Error {
  endpoint: string;
  product: MarketProduct;
  status?: number;

  constructor(message: string, context: MarketRequestContext & { status?: number }) {
    super(message);
    this.name = "MarketDataError";
    this.endpoint = context.endpoint;
    this.product = context.product;
    this.status = context.status;
  }
}

export function buildCoinbaseCandlesUrl({ durationMs, granularity, product }: CandleRequest) {
  const end = new Date();
  const start = new Date(end.getTime() - durationMs);
  const candleUrl = new URL(`${COINBASE_EXCHANGE_BASE_URL}/products/${product}/candles`);
  candleUrl.searchParams.set("granularity", String(granularity));
  candleUrl.searchParams.set("start", start.toISOString());
  candleUrl.searchParams.set("end", end.toISOString());

  return candleUrl;
}

export function buildCoinbaseTickerUrl(product: MarketProduct) {
  return new URL(`${COINBASE_EXCHANGE_BASE_URL}/products/${product}/ticker`);
}

export function parseCoinbaseCandles(payload: unknown): MarketCandle[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((item): item is CoinbaseCandlePayload => {
      return (
        Array.isArray(item) &&
        item.length >= 6 &&
        item.every((value) => typeof value === "number" && Number.isFinite(value))
      );
    })
    .map(([time, low, high, open, close, volume]) => ({
      close,
      high,
      low,
      open,
      time,
      volume,
    }))
    .sort((a, b) => a.time - b.time);
}

async function fetchCoinbaseJson<T>(
  url: URL,
  context: MarketRequestContext,
  signal?: AbortSignal,
) {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new MarketDataError(`${context.product} ${context.endpoint} is temporarily unavailable.`, {
      ...context,
      status: response.status,
    });
  }

  return (await response.json()) as T;
}

export async function fetchCoinbaseCandles(request: CandleRequest) {
  const candleUrl = buildCoinbaseCandlesUrl(request);
  const candlePayload = await fetchCoinbaseJson<unknown>(
    candleUrl,
    { endpoint: "candles", product: request.product },
    request.signal,
  );
  const parsedCandles = parseCoinbaseCandles(candlePayload);

  if (parsedCandles.length === 0) {
    throw new MarketDataError(`Coinbase returned no ${request.product} candles for this range.`, {
      endpoint: "candles",
      product: request.product,
    });
  }

  return parsedCandles;
}

export async function fetchCoinbaseTicker(product: MarketProduct, signal?: AbortSignal) {
  return fetchCoinbaseJson<TickerResponse>(
    buildCoinbaseTickerUrl(product),
    { endpoint: "ticker", product },
    signal,
  );
}

export async function fetchMarketSnapshot(request: CandleRequest): Promise<MarketSnapshot> {
  const [candles, ticker] = await Promise.all([
    fetchCoinbaseCandles(request),
    fetchCoinbaseTicker(request.product, request.signal),
  ]);

  return {
    candles,
    requestedAt: new Date(),
    ticker,
  };
}
