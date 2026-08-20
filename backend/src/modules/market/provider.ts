// Market data provider abstraction.
// Providers are selected by asset class with a synthetic fallback so the system
// always works, even offline. This keeps the platform vendor-agnostic — swap a
// licensed provider in without touching consumers.

import type { Candle, Quote } from '../types';

export const TIMEFRAMES: Record<string, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
};

export type AssetClass = 'crypto' | 'stock' | 'forex' | 'commodity' | 'index';

export const ASSET_CLASSES: Record<string, AssetClass> = {
  BTC: 'crypto',
  ETH: 'crypto',
  SOL: 'crypto',
  XRP: 'crypto',
  BNB: 'crypto',
  DOGE: 'crypto',
  AAPL: 'stock',
  MSFT: 'stock',
  GOOGL: 'stock',
  AMZN: 'stock',
  TSLA: 'stock',
  NVDA: 'stock',
  META: 'stock',
  SPY: 'index',
  QQQ: 'index',
  EURUSD: 'forex',
  GBPUSD: 'forex',
  USDJPY: 'forex',
  XAUUSD: 'commodity',
  BTCUSDT: 'crypto',
  ETHUSDT: 'crypto',
};

export function assetClass(symbol: string): AssetClass {
  return ASSET_CLASSES[symbol.toUpperCase()] ?? 'stock';
}

export interface MarketDataProvider {
  name: string;
  /** Whether this provider can serve the given symbol/timeframe. */
  supports(symbol: string, timeframe: string): boolean;
  getCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]>;
  getQuote?(symbol: string): Promise<Quote | null>;
}

export type { Candle, Quote };
