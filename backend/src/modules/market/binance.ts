// Binance market data provider (public REST, no API key required).
// Real-time crypto candles and quotes. Fails gracefully when unreachable so the
// system falls back to synthetic data.

import type { Candle, Quote } from '../types';
import { TIMEFRAMES, type MarketDataProvider } from './provider';

const BINANCE_INTERVALS: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
  '1M': '1M',
};

const CRYPTO_PAIRS: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  XRP: 'XRPUSDT',
  BNB: 'BNBUSDT',
  DOGE: 'DOGEUSDT',
  BTCUSDT: 'BTCUSDT',
  ETHUSDT: 'ETHUSDT',
};

export class BinanceProvider implements MarketDataProvider {
  readonly name = 'binance';
  private base: string;

  constructor(base = process.env.BINANCE_API_BASE || 'https://api.binance.com') {
    this.base = base;
  }

  supports(symbol: string, timeframe: string): boolean {
    return Boolean(CRYPTO_PAIRS[symbol.toUpperCase()]) && Boolean(BINANCE_INTERVALS[timeframe]);
  }

  private async fetchJson(url: string): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async getCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
    const pair = CRYPTO_PAIRS[symbol.toUpperCase()];
    const interval = BINANCE_INTERVALS[timeframe];
    if (!pair || !interval) return [];
    const url = `${this.base}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${count}`;
    const json = await this.fetchJson(url);
    if (!Array.isArray(json) || json.length === 0) return [];
    return json.map((k: any[]) => ({
      ts: new Date(k[0]).toISOString(),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  }

  async getQuote(symbol: string): Promise<Quote | null> {
    const pair = CRYPTO_PAIRS[symbol.toUpperCase()];
    if (!pair) return null;
    const url = `${this.base}/api/v3/ticker/24hr?symbol=${pair}`;
    const json = await this.fetchJson(url);
    if (!json || json.lastPrice == null) return null;
    const price = Number(json.lastPrice);
    const open = Number(json.openPrice);
    return {
      symbol: symbol.toUpperCase(),
      price,
      change: open > 0 ? ((price - open) / open) * 100 : 0,
      ts: new Date().toISOString(),
    };
  }
}

/** Best effort: 24h trading open/close for percent change is fine for quotes. */
void TIMEFRAMES;
