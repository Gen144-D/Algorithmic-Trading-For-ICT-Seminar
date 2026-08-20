// Strategy engine (TypeScript) — indicator series, condition evaluation,
// signal generation and the v2 backtester (fees, slippage, shorting, trailing
// stops, extended metrics).

import {
  sma, ema, rsi, macd, bollinger, atr, stochastic, adx, vwap, momentum, slope,
  type MacdPoint, type BollingerPoint, type StochPoint,
} from './indicators';
import { sizePosition } from './risk';
import type {
  BacktestOptions, BacktestResult, BacktestTrade, Candle, Condition, Strategy, StrategyRule,
} from './types';
import { TIMEFRAMES } from './market/provider';

export interface Series {
  close: number[];
  open: number[];
  high: number[];
  low: number[];
  volume: number[];
  sma: Record<string, Array<number | null>>;
  ema: Record<string, Array<number | null>>;
  rsi: Record<string, Array<number | null>>;
  macd: Record<string, Array<MacdPoint | null>>;
  bollinger: Record<string, Array<BollingerPoint | null>>;
  stoch: Record<string, Array<StochPoint | null>>;
  atr: Array<number | null>;
  adx: Array<number | null>;
  vwap: Array<number | null>;
  momentum: Array<number | null>;
  slope: Array<number | null>;
}

export function buildSeries(candles: Candle[], rules: StrategyRule = { buyConditions: [], sellConditions: [] }): Series {
  const ind = rules.indicators || {};
  const closes = candles.map((c) => c.close);
  return {
    close: closes,
    open: candles.map((c) => c.open),
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    volume: candles.map((c) => c.volume),
    sma: {
      sma_fast: sma(closes, ind.sma_fast || 20),
      sma_slow: sma(closes, ind.sma_slow || 50),
    },
    ema: {
      ema_fast: ema(closes, ind.ema_fast || 20),
      ema_slow: ema(closes, ind.ema_slow || 50),
    },
    rsi: { default: rsi(closes, ind.rsi_period || 14) },
    macd: { default: macd(closes, ind.macd_fast || 12, ind.macd_slow || 26, ind.macd_signal || 9) },
    bollinger: { default: bollinger(closes, ind.boll_period || 20, ind.boll_mult || 2) },
    stoch: { default: stochastic(candles, ind.stoch_k || 14, ind.stoch_d || 3) },
    atr: atr(candles, ind.atr_period || 14),
    adx: adx(candles, ind.adx_period || 14),
    vwap: vwap(candles),
    momentum: momentum(closes, ind.momentum_period || 10),
    slope: slope(closes, ind.slope_period || 14),
  };
}

/** Resolves a named series to its scalar value at bar i. */
export function seriesValue(s: Series, name: string, i: number): number | null {
  switch (name) {
    case 'close': return s.close[i];
    case 'open': return s.open[i];
    case 'high': return s.high[i];
    case 'low': return s.low[i];
    case 'volume': return s.volume[i];
    case 'atr': return s.atr[i];
    case 'adx': return s.adx[i];
    case 'vwap': return s.vwap[i];
    case 'momentum': return s.momentum[i];
    case 'slope': return s.slope[i];
    case 'macd': return s.macd.default?.[i]?.macd ?? null;
    case 'macd_signal': return s.macd.default?.[i]?.signal ?? null;
    case 'macd_hist': return s.macd.default?.[i]?.histogram ?? null;
    case 'rsi': return s.rsi.default?.[i] ?? null;
    case 'stoch_k': return s.stoch.default?.[i]?.k ?? null;
    case 'stoch_d': return s.stoch.default?.[i]?.d ?? null;
    case 'boll_upper': return s.bollinger.default?.[i]?.upper ?? null;
    case 'boll_middle': return s.bollinger.default?.[i]?.middle ?? null;
    case 'boll_lower': return s.bollinger.default?.[i]?.lower ?? null;
    default:
      if (s.sma[name] != null) return s.sma[name][i];
      if (s.ema[name] != null) return s.ema[name][i];
      if (name.startsWith('sma_')) return s.sma[name.slice(4)]?.[i] ?? null;
      if (name.startsWith('ema_')) return s.ema[name.slice(4)]?.[i] ?? null;
      return null;
  }
}

function truthy(v: number | null | undefined): boolean {
  return v != null && !Number.isNaN(v);
}

export function evaluateCondition(cond: Condition, s: Series, i: number): boolean {
  switch (cond.type) {
    case 'crossover':
    case 'crossunder': {
      if (i < 1) return false;
      const fPrev = seriesValue(s, (cond.fast as string) || 'sma_fast', i - 1);
      const sPrev = seriesValue(s, (cond.slow as string) || 'sma_slow', i - 1);
      const fNow = seriesValue(s, (cond.fast as string) || 'sma_fast', i);
      const sNow = seriesValue(s, (cond.slow as string) || 'sma_slow', i);
      if (!truthy(fPrev) || !truthy(sPrev) || !truthy(fNow) || !truthy(sNow)) return false;
      if (cond.type === 'crossover') return fPrev! <= sPrev! && fNow! > sNow!;
      return fPrev! >= sPrev! && fNow! < sNow!;
    }
    case 'above': {
      const v = seriesValue(s, (cond.indicator as string) || 'close', i);
      return truthy(v) && v! > (cond.value ?? 0);
    }
    case 'below': {
      const v = seriesValue(s, (cond.indicator as string) || 'close', i);
      return truthy(v) && v! < (cond.value ?? 0);
    }
    case 'cross_above':
    case 'cross_below': {
      if (i < 1) return false;
      const prev = seriesValue(s, (cond.indicator as string) || 'close', i - 1);
      const now = seriesValue(s, (cond.indicator as string) || 'close', i);
      const target = cond.value ?? 0;
      if (!truthy(prev) || !truthy(now)) return false;
      if (cond.type === 'cross_above') return prev! <= target && now! > target;
      return prev! >= target && now! < target;
    }
    case 'band_above': {
      const up = s.bollinger.default?.[i]?.upper;
      return truthy(up) && s.close[i] > up!;
    }
    case 'band_below': {
      const low = s.bollinger.default?.[i]?.lower;
      return truthy(low) && s.close[i] < low!;
    }
    case 'histogram_above': {
      const h = s.macd.default?.[i]?.histogram;
      return truthy(h) && h! > (cond.value ?? 0);
    }
    case 'histogram_below': {
      const h = s.macd.default?.[i]?.histogram;
      return truthy(h) && h! < (cond.value ?? 0);
    }
    case 'always':
      return true;
    default:
      return false;
  }
}

export function evaluateAll(conditions: Condition[] | undefined, s: Series, i: number): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, s, i));
}

export interface Signal {
  signal: 'BUY' | 'SELL' | 'WAIT';
  indicators: Record<string, number | null>;
  ts?: string;
}

/** Evaluates the strategy at the latest bar only (engine tick). */
export function checkSignal(candles: Candle[], strategy: Pick<Strategy, 'rules'>): Signal {
  const rules = strategy.rules || { buyConditions: [], sellConditions: [] };
  const s = buildSeries(candles, rules);
  const i = candles.length - 1;
  if (i < 1) return { signal: 'WAIT', indicators: {} };
  const buy = evaluateAll(rules.buyConditions, s, i);
  const sell = evaluateAll(rules.sellConditions, s, i);
  const indicators: Record<string, number | null> = {};
  for (const name of ['close', 'sma_fast', 'sma_slow', 'rsi', 'macd', 'atr', 'vwap', 'adx']) {
    indicators[name] = seriesValue(s, name, i);
  }
  if (buy && !sell) return { signal: 'BUY', indicators, ts: candles[i].ts };
  if (sell && !buy) return { signal: 'SELL', indicators, ts: candles[i].ts };
  return { signal: 'WAIT', indicators, ts: candles[i].ts };
}

// ---------- Backtest v2 ----------

interface Position {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: string;
  quantity: number;
  entryIndex: number;
}

const periodsPerYear: Record<string, number> = {
  '1m': 525600, '5m': 105120, '15m': 35040, '1h': 8760, '4h': 2190,
  '1d': 365, '1w': 52, '1M': 12,
};

export function backtest(candles: Candle[], strategy: Pick<Strategy, 'rules' | 'risk' | 'symbol' | 'timeframe'>, opts: BacktestOptions = {}): BacktestResult {
  const rules = strategy.rules || { buyConditions: [], sellConditions: [] };
  const risk = strategy.risk || {};
  const initialCapital = opts.initialCapital ?? 10000;
  const feePct = opts.feePct ?? 0;
  const slippagePct = opts.slippagePct ?? 0;
  const allowShort = opts.allowShort ?? false;
  const s = buildSeries(candles, rules);

  // Warmup: skip until the slowest indicator has enough bars.
  const ind = rules.indicators || {};
  const slowest = Math.max(
    ind.sma_slow || 50,
    ind.ema_slow || 50,
    (ind.macd_slow || 26) + (ind.macd_signal || 9),
    ind.adx_period ? ind.adx_period * 2 + 1 : 0,
    ind.rsi_period || 14,
    2
  );
  const start = Math.min(slowest + 5, candles.length);

  let cash = initialCapital;
  const pos: { value: Position | null } = { value: null };
  const trades: BacktestTrade[] = [];
  const equityCurve: { i: number; ts: string; equity: number }[] = [];
  let peak = initialCapital;
  let maxDrawdown = 0;
  let feesPaid = 0;
  let slippagePaid = 0;

  const fee = (notional: number) => (notional * feePct) / 100;

  const openLong = (i: number) => {
    const { notional } = sizePosition(risk, cash + positionValue(s, pos.value, candles[i].close), candles[i].close);
    const slip = candles[i].close * (slippagePct / 100);
    const entryPrice = candles[i].close + slip;
    const qty = Math.max(notional, 0) / entryPrice;
    const cost = qty * entryPrice;
    const f = fee(cost);
    cash -= cost + f;
    feesPaid += f;
    slippagePaid += slip * qty;
    pos.value = { side: 'LONG', entryPrice, entryTime: candles[i].ts, quantity: qty, entryIndex: i };
  };

  const openShort = (i: number) => {
    const { notional } = sizePosition(risk, cash + positionValue(s, pos.value, candles[i].close), candles[i].close);
    const slip = candles[i].close * (slippagePct / 100);
    const entryPrice = candles[i].close - slip;
    const qty = Math.max(notional, 0) / entryPrice;
    const f = fee(qty * entryPrice);
    cash -= f; // margin cost is notional deducted as collateral; use proceeds-based P/L
    feesPaid += f;
    slippagePaid += slip * qty;
    pos.value = { side: 'SHORT', entryPrice, entryTime: candles[i].ts, quantity: qty, entryIndex: i };
  };

  const closePosition = (i: number, price: number, reason: string) => {
    const p = pos.value;
    if (!p) return;
    const f = fee(Math.abs(p.quantity) * price);
    feesPaid += f;
    let pnl: number;
    if (p.side === 'LONG') {
      pnl = (price - p.entryPrice) * p.quantity;
      cash += p.quantity * price - f;
    } else {
      pnl = (p.entryPrice - price) * p.quantity;
      cash += p.quantity * p.entryPrice - p.quantity * price - f;
    }
    trades.push({
      entryTime: p.entryTime,
      exitTime: candles[i].ts,
      entryPrice: p.entryPrice,
      exitPrice: price,
      quantity: p.quantity,
      pnl,
      reason,
    });
    pos.value = null;
  };

  function positionValue(_s: Series, pos: Position | null, price: number): number {
    if (!pos) return 0;
    if (pos.side === 'LONG') return pos.quantity * price;
    return pos.quantity * (2 * pos.entryPrice - price) - pos.quantity * pos.entryPrice;
  }

  for (let i = start; i < candles.length; i++) {
    const bar = candles[i];
    const slPct = (risk.stopLossPct || 0) / 100;
    const tpPct = (risk.takeProfitPct || 0) / 100;
    const trailPct = (risk.trailingStopPct || 0) / 100;

    const position = pos.value;
    if (position) {
      let exitPrice: number | null = null;
      let reason = '';
      const isLong = position.side === 'LONG';

      // trailing stop: track best price since entry
      if (trailPct > 0) {
        const best = isLong
          ? Math.max(position.entryPrice, ...candles.slice(position.entryIndex, i + 1).map((c) => c.high))
          : Math.min(position.entryPrice, ...candles.slice(position.entryIndex, i + 1).map((c) => c.low));
        const trailStop = isLong ? best * (1 - trailPct) : best * (1 + trailPct);
        if (isLong ? bar.low <= trailStop : bar.high >= trailStop) {
          exitPrice = trailStop;
          reason = 'TRAILING_STOP';
        }
      }

      if (exitPrice == null && slPct > 0) {
        const sl = isLong
          ? position.entryPrice * (1 - slPct)
          : position.entryPrice * (1 + slPct);
        if (isLong ? bar.low <= sl : bar.high >= sl) {
          exitPrice = sl;
          reason = 'STOP_LOSS';
        }
      }
      if (exitPrice == null && tpPct > 0) {
        const tp = isLong
          ? position.entryPrice * (1 + tpPct)
          : position.entryPrice * (1 - tpPct);
        if (isLong ? bar.high >= tp : bar.low <= tp) {
          exitPrice = tp;
          reason = 'TAKE_PROFIT';
        }
      }
      if (exitPrice == null) {
        const exitSignal = isLong
          ? evaluateAll(rules.sellConditions, s, i)
          : evaluateAll(rules.buyConditions, s, i);
        if (exitSignal) {
          exitPrice = bar.close;
          reason = 'SIGNAL';
        }
      }
      if (exitPrice != null) closePosition(i, exitPrice, reason);
    }

    if (!pos.value) {
      if (evaluateAll(rules.buyConditions, s, i)) openLong(i);
      else if (allowShort && evaluateAll(rules.sellConditions, s, i)) openShort(i);
    }

    const equity = cash + positionValue(s, pos.value, bar.close);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100);
    equityCurve.push({ i, ts: bar.ts, equity: Math.round(equity * 100) / 100 });
  }

  if (pos.value) closePosition(candles.length - 1, candles[candles.length - 1].close, 'END');

  const finalEquity = cash;
  const totalReturnPct = ((finalEquity - initialCapital) / initialCapital) * 100;
  const ppe = periodsPerYear[strategy.timeframe] ?? 8760;
  const bars = Math.max(candles.length - start, 1);
  const annualizedReturnPct =
    finalEquity > 0 && initialCapital > 0
      ? (Math.pow(finalEquity / initialCapital, ppe / bars) - 1) * 100
      : 0;

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const returns = trades.map((t) => t.pnl / (t.quantity * t.entryPrice || 1));
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const variance = (arr: number[]) => {
    const m = avg(arr);
    return arr.length ? arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length : 0;
  };
  const downside = returns.filter((r) => r < 0);

  return {
    symbol: strategy.symbol,
    timeframe: strategy.timeframe,
    initialCapital,
    finalEquity: Math.round(finalEquity * 100) / 100,
    totalReturnPct: Math.round(totalReturnPct * 100) / 100,
    annualizedReturnPct: Math.round(annualizedReturnPct * 100) / 100,
    numTrades: trades.length,
    winRate: trades.length ? Math.round((wins.length / trades.length) * 100) : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    avgWinPct: wins.length ? (avg(wins.map((t) => (t.pnl / (t.quantity * t.entryPrice)) * 100))) : 0,
    avgLossPct: losses.length ? avg(losses.map((t) => (t.pnl / (t.quantity * t.entryPrice)) * 100)) : 0,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpe: returns.length ? avg(returns) / (Math.sqrt(variance(returns)) || 1) : 0,
    sortino: returns.length ? avg(returns) / (Math.sqrt(variance(downside)) || 1) : 0,
    avgTrade: returns.length ? avg(returns) * 100 : 0,
    largestWin: wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl)) : 0,
    expectancy: trades.length ? grossWin / trades.length - grossLoss / trades.length : 0,
    feesPaid: Math.round(feesPaid * 100) / 100,
    slippagePaid: Math.round(slippagePaid * 100) / 100,
    trades,
    equityCurve,
  };
}

/** Simple grid-search optimizer over named indicator parameters. */
export function optimize(
  candles: Candle[],
  baseStrategy: Pick<Strategy, 'rules' | 'risk' | 'symbol' | 'timeframe'>,
  paramSpace: Record<string, number[]>,
  opts: BacktestOptions = {}
): { params: Record<string, number>; result: BacktestResult }[] {
  const keys = Object.keys(paramSpace);
  const results: { params: Record<string, number>; result: BacktestResult }[] = [];

  const recurse = (idx: number, chosen: Record<string, number>) => {
    if (idx === keys.length) {
      const rules: StrategyRule = {
        ...(baseStrategy.rules || {}),
        indicators: { ...(baseStrategy.rules?.indicators || {}), ...chosen },
      };
      const strategy = { ...baseStrategy, rules };
      const result = backtest(candles, strategy, opts);
      results.push({ params: chosen, result });
      return;
    }
    for (const v of paramSpace[keys[idx]]) {
      recurse(idx + 1, { ...chosen, [keys[idx]]: v });
    }
  };
  recurse(0, {});
  return results.sort((a, b) => b.result.totalReturnPct - a.result.totalReturnPct);
}

/** Walk-forward split: train on first 70%, validate on last 30%. */
export function walkForward(
  candles: Candle[],
  baseStrategy: Pick<Strategy, 'rules' | 'risk' | 'symbol' | 'timeframe'>,
  paramSpace: Record<string, number[]>,
  opts: BacktestOptions = {}
): { inSample: typeof results; outOfSample: typeof results } {
  const split = Math.floor(candles.length * 0.7);
  const train = candles.slice(0, split);
  const test = candles.slice(split);
  const results = optimize(train, baseStrategy, paramSpace, opts);
  const best = results[0];
  if (!best) return { inSample: results, outOfSample: [] };
  const rules: StrategyRule = {
    ...(baseStrategy.rules || {}),
    indicators: { ...(baseStrategy.rules?.indicators || {}), ...best.params },
  };
  const outOfSample = backtest(test, { ...baseStrategy, rules }, opts);
  return { inSample: results, outOfSample: [best, { params: best.params, result: outOfSample }] };
}

/** Warmup threshold shared with the engine for consistent signal starts. */
export function warmupStart(candles: Candle[], rules: StrategyRule): number {
  const ind = rules.indicators || {};
  return Math.min(
    Math.max(ind.sma_slow || 50, ind.ema_slow || 50, ind.rsi_period || 14, 2) + 5,
    candles.length
  );
}

void TIMEFRAMES;