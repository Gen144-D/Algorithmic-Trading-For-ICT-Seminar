// TwelveData market data provider (REST).
// Covers stocks, forex, crypto, commodities and indices. Requires an API key
// (MARKET_DATA_API_KEY). Designed as a development/MVP source — swap in a
// commercially-licensed provider behind the same interface for production.

import type { Candle } from '../types';
import { TIMEFRAMES, type MarketDataProvider } from './provider';

const INTERVALS: Record<string, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '1h': '1hour',
  '4h': '4hour',
  '1d': '1day',
  '1w': '1week',
  '1M': '1month',
};

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'twelvedata';
  private apiKey: string;
  private base: string;

  constructor(apiKey?: string, base?: string) {
    this.apiKey = apiKey || process.env.MARKET_DATA_API_KEY || '';
    this.base = base || process.env.MARKET_DATA_API_BASE || 'https://api.twelvedata.com';
  }

  supports(symbol: string, timeframe: string): boolean {
    return Boolean(this.apiKey) && Boolean(INTERVALS[timeframe]);
  }

  /** TwelveData expects EUR/USD style symbols for forex; plain codes otherwise. */
  private encode(symbol: string): string {
    return symbol.toUpperCase();
  }

  async getCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
    const interval = INTERVALS[timeframe];
    if (!this.apiKey || !interval) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = `${this.base}/time_series?symbol=${encodeURIComponent(this.encode(symbol))}&interval=${interval}&outputsize=${count}&apikey=${this.apiKey}`;
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) return [];
      const json: any = await resp.json();
      if (!Array.isArray(json.values)) return [];
      return json.values
        .slice()
        .reverse()
        .map((v: any) => ({
          ts: new Date(v.datetime).toISOString(),
          open: Number(v.open),
          high: Number(v.high),
          low: Number(v.low),
          close: Number(v.close),
          volume: Number(v.volume) || 0,
        }));
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}

void TIMEFRAMES;
