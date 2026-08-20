// Market data service — orchestrates providers with caching and a "live" engine
// mode. Consumed by the REST API, WebSocket feed and the trading engine.

import type { Candle, Quote } from '../types';
import { TIMEFRAMES, assetClass, type MarketDataProvider } from './provider';
import { SyntheticProvider, generateSynthetic, mulberry32, hashSeed } from './synthetic';
import { BinanceProvider } from './binance';
import { TwelveDataProvider } from './twelvedata';

export { TIMEFRAMES };

export const SYMBOLS: string[] = [
  'BTC', 'ETH', 'SOL', 'XRP',
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META',
  'SPY', 'QQQ',
  'EURUSD', 'GBPUSD', 'USDJPY',
  'XAUUSD',
];

export interface StoreLike {
  getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]>;
  saveCandles(symbol: string, timeframe: string, rows: Candle[]): Promise<unknown>;
}

export interface MarketServiceOptions {
  store: StoreLike;
  providers?: MarketDataProvider[];
  /** Skip external network calls entirely (offline dev). */
  offline?: boolean;
}

let _defaultProviders: MarketDataProvider[] | null = null;

export function defaultProviders(): MarketDataProvider[] {
  if (_defaultProviders) return _defaultProviders;
  _defaultProviders = [new BinanceProvider(), new TwelveDataProvider(), new SyntheticProvider()];
  return _defaultProviders;
}

export function createMarketService(opts: MarketServiceOptions) {
  const store = opts.store;
  const providers = opts.providers ?? defaultProviders();
  const offline = opts.offline ?? process.env.MARKET_OFFLINE === '1';

  /** Ordered providers that can serve this symbol, real first, synthetic last. */
  function chain(symbol: string, timeframe: string): MarketDataProvider[] {
    if (offline) return providers.filter((p) => p.name === 'synthetic');
    const sorted = providers.filter((p) => p.supports(symbol, timeframe));
    return sorted;
  }

  async function fetchReal(symbol: string, timeframe: string, count: number): Promise<Candle[] | null> {
    for (const p of chain(symbol, timeframe)) {
      if (p.name === 'synthetic') continue;
      try {
        const rows = await p.getCandles(symbol, timeframe, count);
        if (rows && rows.length >= 2) return rows.slice(-count);
      } catch {
        // try next provider
      }
    }
    return null;
  }

  function isFresh(symbol: string, timeframe: string, rows: Candle[]): boolean {
    if (!rows.length) return false;
    const lastTs = new Date(rows[rows.length - 1].ts).getTime();
    const step = TIMEFRAMES[timeframe] || 60 * 60 * 1000;
    return Date.now() - lastTs < step * 2;
  }

  /**
   * Historical candles with a store cache:
   *  1. external provider (real data) when the store is missing or stale
   *  2. store
   *  3. synthetic (always works)
   */
  async function getCandles(
    symbol: string,
    timeframe = '1h',
    count = 300,
    opts: { live?: boolean } = {}
  ): Promise<Candle[]> {
    const upper = symbol.toUpperCase();
    if (opts.live) return getLiveCandles(upper, timeframe, count);

    const stored = await store.getCandles(upper, timeframe, count).catch(() => []);
    if (!isFresh(upper, timeframe, stored)) {
      const real = await fetchReal(upper, timeframe, Math.max(count, 200));
      if (real && real.length) {
        await store.saveCandles(upper, timeframe, real).catch(() => {});
        return real;
      }
      if (stored.length >= count) return stored;
      const synth = generateSynthetic(upper, timeframe, count);
      await store.saveCandles(upper, timeframe, synth).catch(() => {});
      return synth;
    }
    return stored.slice(-count);
  }

  /** Engine mode: advancing window. Real provider when available, else synthetic walk. */
  const liveSeries = new Map<string, { candles: Candle[]; rng: () => number }>();

  async function getLiveCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
    const key = `${symbol}:${timeframe}`;
    const step = TIMEFRAMES[timeframe] || 60 * 60 * 1000;

    const real = await fetchReal(symbol, timeframe, count);
    if (real && real.length) return real;

    if (!liveSeries.has(key)) {
      liveSeries.set(key, {
        candles: generateSynthetic(symbol, timeframe, Math.max(count, 400)),
        rng: mulberry32(hashSeed(`${key}:livewalk`)),
      });
    }
    const state = liveSeries.get(key)!;
    const barsPerTick = Number(process.env.LIVE_BARS_PER_TICK || 40);
    let prev = state.candles[state.candles.length - 1].close;
    const now = Date.now();
    for (let b = 0; b < barsPerTick; b++) {
      const ts = new Date(now - (barsPerTick - 1 - b) * step).toISOString();
      const open = prev;
      const chg = (state.rng() + state.rng() + state.rng() - 1.5) * 0.02 * open;
      const close = Math.max(open + chg, 1);
      const high = Math.max(open, close) * (1 + state.rng() * 0.004);
      const low = Math.min(open, close) * (1 - state.rng() * 0.004);
      const volume = Math.floor(state.rng() * 20000) + 1000;
      state.candles.push({ ts, open, high, low, close, volume });
      prev = close;
    }
    if (state.candles.length > 400) state.candles = state.candles.slice(-400);
    return state.candles.slice(-count).map((c) => ({ ...c }));
  }

  async function getQuote(symbol: string): Promise<Quote | null> {
    const candles = await getCandles(symbol, '1h', 2);
    const last = candles[candles.length - 1];
    if (!last) return null;
    const prev = candles[candles.length - 2]?.close ?? last.open;
    return {
      symbol: symbol.toUpperCase(),
      price: last.close,
      change: prev > 0 ? ((last.close - prev) / prev) * 100 : 0,
      ts: last.ts,
    };
  }

  return { getCandles, getQuote, chain, assetClassOf: assetClass };
}

export type MarketService = ReturnType<typeof createMarketService>;
