// Deterministic synthetic candles (repeatable per symbol/timeframe seed) so the
// platform runs end-to-end without any external provider.

import type { Candle } from '../types';
import { TIMEFRAMES } from './provider';

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Optionally inject a trend so demo strategies can actually win/lose. */
export function generateSynthetic(symbol: string, timeframe: string, count = 300): Candle[] {
  const step = TIMEFRAMES[timeframe] || 60 * 60 * 1000;
  const rng = mulberry32(hashSeed(`${symbol}:${timeframe}:seed`));
  const vol = 0.02;
  // Symbol-dependent drift so some assets trend while others chop.
  const drift = (rng() - 0.5) * 0.002;
  let close = 50 + rng() * 150;
  const rows: Candle[] = [];
  const end = Math.floor(Date.now() / step) * step;
  for (let i = count - 1; i >= 0; i--) {
    const ts = new Date(end - i * step).toISOString();
    const open = close;
    const chg = (rng() + rng() + rng() - 1.5) * vol * open + drift * open;
    close = Math.max(open + chg, 1);
    const high = Math.max(open, close) * (1 + rng() * 0.005);
    const low = Math.min(open, close) * (1 - rng() * 0.005);
    const volume = Math.floor(rng() * 20000) + 1000;
    rows.push({ ts, open, high, low, close, volume });
  }
  return rows;
}

export class SyntheticProvider {
  readonly name = 'synthetic';

  supports(): boolean {
    return true;
  }

  getCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]> {
    return Promise.resolve(generateSynthetic(symbol, timeframe, count));
  }
}
