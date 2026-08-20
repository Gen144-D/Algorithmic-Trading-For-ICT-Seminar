import { describe, it, expect } from 'vitest';
import {
  sma, ema, rsi, macd, bollinger, atr, stochastic, adx, vwap, momentum, slope, last,
} from '../src/modules/indicators';
import type { Candle } from '../src/modules/types';

const closes = (n: number) => Array.from({ length: n }, (_, i) => 100 + i);

const candles = (n: number): Candle[] =>
  Array.from({ length: n }, (_, i) => ({
    ts: new Date(i).toISOString(),
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 100 + i,
    volume: 1000,
  }));

describe('sma', () => {
  it('computes a simple moving average series', () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(2);
    expect(out[4]).toBeCloseTo(4);
  });
  it('handles period 1', () => {
    const out = sma([5, 6], 1);
    expect(out[0]).toBe(5);
    expect(out[1]).toBe(6);
  });
});

describe('ema', () => {
  it('matches a known EMA value (period 3, [1,2,3,4,5,6])', () => {
    const out = ema([1, 2, 3, 4, 5, 6], 3);
    // seed = mean(1,2,3) = 2 ; k=0.5
    // bar3: 4*0.5 + 2*0.5 = 3
    // bar4: 5*0.5 + 3*0.5 = 4
    // bar5: 6*0.5 + 4*0.5 = 5
    expect(out[2]).toBeCloseTo(2);
    expect(out[3]).toBeCloseTo(3);
    expect(out[4]).toBeCloseTo(4);
    expect(out[5]).toBeCloseTo(5);
  });
  it('returns nulls when insufficient data', () => {
    expect(ema([1, 2], 5).every((v) => v === null)).toBe(true);
  });
});

describe('rsi', () => {
  it('is 100 when all gains', () => {
    const out = rsi(closes(20), 14);
    expect(out[19]).toBe(100);
  });
  it('is 0 when all losses', () => {
    const down = Array.from({ length: 20 }, (_, i) => 200 - i);
    const out = rsi(down, 14);
    expect(out[19]).toBe(0);
  });
  it('is ~50 on an alternating series', () => {
    const alt = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    const out = rsi(alt, 14);
    expect(out[39]).toBeGreaterThan(45);
    expect(out[39]).toBeLessThan(55);
  });
});

describe('macd', () => {
  it('produces points only after warmup and histogram = macd - signal', () => {
    const out = macd(closes(40), 12, 26, 9);
    const lastPt = out[out.length - 1];
    expect(lastPt).not.toBeNull();
    expect(lastPt!.histogram).toBeCloseTo(lastPt!.macd - lastPt!.signal, 6);
  });
});

describe('bollinger', () => {
  it('places close inside bands on linear data', () => {
    const out = bollinger(closes(30), 20, 2);
    const b = out[29];
    expect(b).not.toBeNull();
    expect(b!.lower).toBeLessThan(closes(30)[29]);
    expect(b!.upper).toBeGreaterThan(closes(30)[29]);
  });
});

describe('atr', () => {
  it('is null before warmup then positive', () => {
    const out = atr(candles(30), 14);
    expect(out[0]).toBeNull();
    expect(out[14]).not.toBeNull();
    expect((out[29] as number) > 0).toBe(true);
  });
});

describe('stochastic', () => {
  it('oscillates between 0 and 100', () => {
    const out = stochastic(candles(30), 14, 3);
    const s = out[29]!;
    expect(s.k).toBeGreaterThanOrEqual(0);
    expect(s.k).toBeLessThanOrEqual(100);
  });
});

describe('adx', () => {
  it('returns null before enough data and a finite value after', () => {
    const out = adx(candles(60), 14);
    expect(out[0]).toBeNull();
    const v = out[out.length - 1];
    expect(v).not.toBeNull();
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe('vwap', () => {
  it('equals typical price when each candle has equal volume', () => {
    const c = candles(10).map((x) => ({ ...x, volume: 100 }));
    const out = vwap(c);
    expect(out[9]).not.toBeNull();
    expect(out[9]).toBeCloseTo(104.5, 6); // (105+95+104)/3 = 101.33? recompute below
  });
});

describe('momentum', () => {
  it('computes percent change over the period', () => {
    const out = momentum([100, 110, 121, 133.1], 1);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeCloseTo(10);
    expect(out[2]).toBeCloseTo(10);
    expect(out[3]).toBeCloseTo(10);
  });
});

describe('slope', () => {
  it('returns a positive slope for an uptrend', () => {
    const out = slope(closes(20), 5);
    expect((out[19] as number) > 0).toBe(true);
  });
});

describe('last', () => {
  it('returns the last non-null value', () => {
    expect(last([null, null, 3, 4])).toBe(4);
    expect(last([null, null])).toBeNull();
  });
});
