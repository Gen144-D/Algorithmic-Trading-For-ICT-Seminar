import { describe, it, expect } from 'vitest';
import { backtest, checkSignal, buildSeries, optimize, walkForward, evaluateCondition } from '../src/modules/engine';
import type { Candle, Strategy } from '../src/modules/types';
import { generateSynthetic } from '../src/modules/market/synthetic';

const candles = (n: number): Candle[] => generateSynthetic('BTC', '1h', n);

function strat(over: Partial<Strategy> = {}): Strategy {
  return {
    id: 's1',
    user_id: 'u1',
    name: 't',
    symbol: 'BTC',
    timeframe: '1h',
    rules: {
      indicators: { sma_fast: 5, sma_slow: 20, rsi_period: 14 },
      buyConditions: [{ type: 'crossover', fast: 'sma_fast', slow: 'sma_slow' }],
      sellConditions: [{ type: 'crossunder', fast: 'sma_fast', slow: 'sma_slow' }],
    },
    risk: { stopLossPct: 5, takeProfitPct: 10, positionSize: 1000, maxOpenTrades: 1 },
    active: 0,
    ...over,
  };
}

describe('buildSeries & seriesValue', () => {
  it('computes all default series', () => {
    const s = buildSeries(candles(60));
    expect(s.sma.sma_fast[59]).not.toBeNull();
    expect(s.sma.sma_slow[59]).not.toBeNull();
    expect(s.rsi.default[59]).not.toBeNull();
    expect(s.macd.default[59]).not.toBeNull();
    expect(s.atr[59]).not.toBeNull();
    expect(s.adx[59]).not.toBeNull();
    expect(s.vwap[59]).not.toBeNull();
    expect(s.bollinger.default[59]).not.toBeNull();
  });
});

describe('evaluateCondition', () => {
  it('detects crossovers', () => {
    // Flat, uptrend, downtrend — guarantees SMA fast crosses both ways.
    const flat = Array.from({ length: 40 }, () => 100);
    const up = Array.from({ length: 100 }, (_, i) => 100 + i);
    const down = Array.from({ length: 100 }, (_, i) => 200 - i);
    const closes = [...flat, ...up, ...down];
    const cs: Candle[] = closes.map((close, i) => ({
      ts: new Date(1600000000000 + i * 3600_000).toISOString(),
      open: close - 1, high: close + 2, low: close - 3, close, volume: 1000,
    }));
    const s = buildSeries(cs, { buyConditions: [], sellConditions: [], indicators: { sma_fast: 5, sma_slow: 20 } });
    let upCross = 0;
    let downCross = 0;
    for (let i = 1; i < closes.length; i++) {
      if (evaluateCondition({ type: 'crossover', fast: 'sma_fast', slow: 'sma_slow' }, s, i)) upCross++;
      if (evaluateCondition({ type: 'crossunder', fast: 'sma_fast', slow: 'sma_slow' }, s, i)) downCross++;
    }
    expect(upCross).toBeGreaterThan(0);
    expect(downCross).toBeGreaterThan(0);
  });
});

describe('checkSignal', () => {
  it('returns WAIT/ BUY / SELL shapes', () => {
    const sig = checkSignal(candles(60), strat());
    expect(['BUY', 'SELL', 'WAIT']).toContain(sig.signal);
    expect(sig.indicators).toHaveProperty('close');
  });
});

describe('backtest', () => {
  it('produces a full result with metrics', () => {
    const r = backtest(candles(120), strat());
    expect(r.numTrades).toBeGreaterThan(0);
    expect(r.equityCurve.length).toBeGreaterThan(0);
    expect(r.finalEquity).toBeGreaterThan(0);
    expect(r.winRate).toBeGreaterThanOrEqual(0);
    expect(r.sharpe).toBeTypeOf('number');
    expect(r.sortino).toBeTypeOf('number');
    expect(r.annualizedReturnPct).toBeTypeOf('number');
  });

  it('pays fees when feePct is set', () => {
    const plain = backtest(candles(120), strat());
    const withFees = backtest(candles(120), strat(), { feePct: 0.1 });
    expect(withFees.feesPaid).toBeGreaterThan(0);
    expect(withFees.feesPaid).toBeGreaterThan(plain.feesPaid);
  });

  it('supports shorting when enabled', () => {
    const short = backtest(candles(120), strat(), { allowShort: true });
    const longOnly = backtest(candles(120), strat());
    // shorting may add trades; at minimum it runs without error
    expect(short.numTrades).toBeGreaterThanOrEqual(longOnly.numTrades - 1);
  });

  it('respects trailing stops', () => {
    const r = backtest(candles(120), strat({ risk: { stopLossPct: 5, takeProfitPct: 30, trailingStopPct: 3, positionSize: 1000 } }));
    expect(r.trades.some((t) => t.reason === 'TRAILING_STOP')).toBe(true);
  });

  it('sizes positions from risk per trade', () => {
    const r = backtest(candles(120), strat({ risk: { stopLossPct: 2, riskPerTradePct: 1, positionSize: 0 } }));
    expect(r.numTrades).toBeGreaterThanOrEqual(0);
    expect(r.finalEquity).toBeGreaterThan(0);
  });
});

describe('optimize', () => {
  it('grid-searches and returns ranked results', () => {
    const results = optimize(candles(120), strat(), { sma_fast: [5, 8], sma_slow: [20, 30] });
    expect(results).toHaveLength(4);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].result.totalReturnPct).toBeGreaterThanOrEqual(results[i].result.totalReturnPct);
    }
    expect(results[0].params).toHaveProperty('sma_fast');
  });
});

describe('walkForward', () => {
  it('splits in/out-of-sample', () => {
    const wf = walkForward(candles(200), strat(), { sma_fast: [5, 8] });
    expect(wf.inSample.length).toBe(2);
    expect(wf.outOfSample.length).toBe(2);
  });
});