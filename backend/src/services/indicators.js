// Technical indicators used by the trading engine and backtester.
// Each function takes an array of closes (ascending) and returns a numeric value
// at the final index (or null when there is not enough data).

function sma(closes, period) {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
  }
  return e;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function macd(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return null;
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  if (emaFast == null || emaSlow == null) return null;
  const macdLine = emaFast - emaSlow;
  // crude signal line from a short EMA of the most recent diffs
  const recent = closes.slice(-(slow + signal));
  const diffs = [];
  for (let i = slow - 1; i < recent.length; i++) {
    const f = ema(recent.slice(0, i + 1), fast);
    const s = ema(recent.slice(0, i + 1), slow);
    if (f != null && s != null) diffs.push(f - s);
  }
  const signalLine = ema(diffs, signal);
  return { macd: macdLine, signal: signalLine ?? 0, histogram: macdLine - (signalLine ?? 0) };
}

function bollinger(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const mid = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: mid + mult * sd, middle: mid, lower: mid - mult * sd };
}

function atr(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  const window = trs.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

// Last crossover state between two series, relative to the most recent bar.
// Returns 'bull' when fast crossed above slow, 'bear' when below, null otherwise.
function crossover(closes, fast, slow) {
  if (closes.length < fast + slow + 1) return null;
  const fastPrev = sma(closes.slice(0, -1), fast);
  const slowPrev = sma(closes.slice(0, -1), slow);
  const fastNow = sma(closes, fast);
  const slowNow = sma(closes, slow);
  if (fastPrev == null || slowPrev == null || fastNow == null || slowNow == null) return null;
  if (fastPrev <= slowPrev && fastNow > slowNow) return 'bull';
  if (fastPrev >= slowPrev && fastNow < slowNow) return 'bear';
  return null;
}

module.exports = { sma, ema, rsi, macd, bollinger, atr, crossover };
