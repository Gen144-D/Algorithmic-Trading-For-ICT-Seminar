// Technical indicator library (TypeScript).
// Series-returning functions produce one value per input bar so the strategy
// engine and backtester can walk bars and detect crossovers anywhere in time.
import type { Candle } from './types';

export type NumberSeries = Array<number | null>;

function nulls(n: number): NumberSeries {
  return new Array<number | null>(n).fill(null);
}

/** Simple moving average series. */
export function sma(values: number[], period: number): NumberSeries {
  if (period <= 0) return nulls(values.length);
  const out: NumberSeries = nulls(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average series (full-history seeding). */
export function ema(values: number[], period: number): NumberSeries {
  if (period <= 0) return nulls(values.length);
  const out: NumberSeries = nulls(values.length);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = e;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}

/** Wilder's RSI series. */
export function rsi(values: number[], period = 14): NumberSeries {
  const out: NumberSeries = nulls(values.length);
  if (values.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (d >= 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdPoint {
  macd: number;
  signal: number;
  histogram: number;
}

/** MACD series: fast EMA minus slow EMA, signal = EMA of the macd line. */
export function macd(values: number[], fast = 12, slow = 26, signal = 9): Array<MacdPoint | null> {
  const out: Array<MacdPoint | null> = new Array(values.length).fill(null);
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const line: NumberSeries = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (emaFast[i] != null && emaSlow[i] != null) line[i] = (emaFast[i] as number) - (emaSlow[i] as number);
  }
  const clean = line.map((v, i) => (v == null ? 0 : v));
  const signalLine = ema(clean, signal);
  for (let i = 0; i < values.length; i++) {
    const m = line[i];
    if (m == null || signalLine[i] == null) continue;
    const s = signalLine[i] as number;
    out[i] = { macd: m, signal: s, histogram: m - s };
  }
  return out;
}

export interface BollingerPoint {
  upper: number;
  middle: number;
  lower: number;
}

/** Bollinger Bands series. */
export function bollinger(values: number[], period = 20, mult = 2): Array<BollingerPoint | null> {
  const out: Array<BollingerPoint | null> = new Array(values.length).fill(null);
  const mid = sma(values, period);
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const m = mid[i] as number;
    const variance = window.reduce((a, b) => a + (b - m) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    out[i] = { upper: m + mult * sd, middle: m, lower: m - mult * sd };
  }
  return out;
}

function trueRanges(candles: Candle[]): number[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      tr.push(c.high - c.low);
      continue;
    }
    const pc = candles[i - 1].close;
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc)));
  }
  return tr;
}

/** ATR series (Wilder smoothing). */
export function atr(candles: Candle[], period = 14): NumberSeries {
  const tr = trueRanges(candles);
  const out: NumberSeries = nulls(candles.length);
  if (tr.length < period + 1) return out;
  let a = tr.slice(1, period + 1).reduce((x, y) => x + y, 0) / period;
  out[period] = a;
  for (let i = period + 1; i < tr.length; i++) {
    a = (a * (period - 1) + tr[i]) / period;
    out[i] = a;
  }
  return out;
}

export interface StochPoint {
  k: number;
  d: number;
}

/** Stochastic oscillator series. */
export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): Array<StochPoint | null> {
  const out: Array<StochPoint | null> = new Array(candles.length).fill(null);
  const kRaw: NumberSeries = nulls(candles.length);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let high = -Infinity;
    let low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      high = Math.max(high, candles[j].high);
      low = Math.min(low, candles[j].low);
    }
    const rng = high - low;
    kRaw[i] = rng === 0 ? 50 : ((candles[i].close - low) / rng) * 100;
  }
  const dLine = sma(kRaw.map((v) => v ?? 0), dPeriod);
  for (let i = 0; i < candles.length; i++) {
    if (kRaw[i] == null) continue;
    const k = kRaw[i] as number;
    const d = dLine[i];
    out[i] = { k, d: d ?? k };
  }
  return out;
}

/** ADX series (Wilder). Returns ADX per bar; -DI/+DI null until warmup. */
export function adx(candles: Candle[], period = 14): NumberSeries {
  const out: NumberSeries = nulls(candles.length);
  if (candles.length < period * 2 + 1) return out;
  let plusDM = 0;
  let minusDM = 0;
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const up = c.high - p.high;
    const down = p.low - c.low;
    plusDM += up > down && up > 0 ? up : 0;
    minusDM += down > up && down > 0 ? down : 0;
    trSum += trueRanges([p, c])[1];
  }
  let dxSum = 0;
  for (let i = period + 1; i <= period * 2; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const up = c.high - p.high;
    const down = p.low - c.low;
    const pDM = up > down && up > 0 ? up : 0;
    const mDM = down > up && down > 0 ? down : 0;
    const tr = trueRanges([p, c])[1];
    plusDM = plusDM - plusDM / period + pDM;
    minusDM = minusDM - minusDM / period + mDM;
    trSum = trSum - trSum / period + tr;
    if (trSum === 0) continue;
    const plusDI = (plusDM / trSum) * 100;
    const minusDI = (minusDM / trSum) * 100;
    const sum = plusDI + minusDI;
    if (sum === 0) continue;
    const dx = Math.abs(plusDI - minusDI) / sum * 100;
    dxSum += dx;
  }
  out[period * 2] = dxSum / period;
  for (let i = period * 2 + 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const up = c.high - p.high;
    const down = p.low - c.low;
    const pDM = up > down && up > 0 ? up : 0;
    const mDM = down > up && down > 0 ? down : 0;
    const tr = trueRanges([p, c])[1];
    plusDM = plusDM - plusDM / period + pDM;
    minusDM = minusDM - minusDM / period + mDM;
    trSum = trSum - trSum / period + tr;
    if (trSum === 0) continue;
    const plusDI = (plusDM / trSum) * 100;
    const minusDI = (minusDM / trSum) * 100;
    const sum = plusDI + minusDI;
    if (sum === 0) continue;
    const dx = Math.abs(plusDI - minusDI) / sum * 100;
    dxSum = dxSum - dxSum / period + dx;
    out[i] = dxSum / period;
  }
  return out;
}

/** Rolling VWAP series (per-bar, window-limited). */
export function vwap(candles: Candle[], window = 0): NumberSeries {
  const out: NumberSeries = nulls(candles.length);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumV += c.volume;
    if (window > 0 && i >= window) {
      const old = candles[i - window];
      const oldTypical = (old.high + old.low + old.close) / 3;
      cumPV -= oldTypical * old.volume;
      cumV -= old.volume;
    }
    out[i] = cumV === 0 ? null : cumPV / cumV;
  }
  return out;
}

export function stddev(values: number[], period: number): NumberSeries {
  const out: NumberSeries = nulls(values.length);
  const mid = sma(values, period);
  for (let i = period - 1; i < values.length; i++) {
    const m = mid[i] as number;
    const window = values.slice(i - period + 1, i + 1);
    out[i] = Math.sqrt(window.reduce((a, b) => a + (b - m) ** 2, 0) / period);
  }
  return out;
}

/** Percent-change momentum series over `period` bars. */
export function momentum(values: number[], period = 10): NumberSeries {
  const out: NumberSeries = nulls(values.length);
  for (let i = period; i < values.length; i++) {
    const base = values[i - period];
    out[i] = base === 0 ? 0 : ((values[i] - base) / base) * 100;
  }
  return out;
}

/** Linear-regression slope of the last `period` values, scaled by bar index. */
export function slope(values: number[], period = 14): NumberSeries {
  const out: NumberSeries = nulls(values.length);
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const n = window.length;
    const meanX = (n - 1) / 2;
    const meanY = window.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let j = 0; j < n; j++) {
      num += (j - meanX) * (window[j] - meanY);
      den += (j - meanX) ** 2;
    }
    out[i] = den === 0 ? 0 : num / den;
  }
  return out;
}

/**
 * Returns the last scalar value of a series (or null when not available).
 * Convenience for single-bar "current value" reads.
 */
export function last<T>(series: Array<T | null>): T | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i];
  }
  return null;
}
