const { sma, rsi, crossover } = require('./indicators');

// Builds one value per candle for each named indicator so backtests can walk
// the series and detect crossovers at every bar.
function buildSeries(candles, rules) {
  const ind = rules.indicators || {};
  const closes = candles.map((c) => c.close);
  const fastP = ind.sma_fast || 20;
  const slowP = ind.sma_slow || 50;
  const rsiP = ind.rsi_period || 14;
  const series = { close: closes, sma_fast: [], sma_slow: [], rsi: [] };
  for (let i = 0; i < closes.length; i++) {
    const slice = closes.slice(0, i + 1);
    series.sma_fast.push(sma(slice, fastP));
    series.sma_slow.push(sma(slice, slowP));
    series.rsi.push(rsi(slice, rsiP));
  }
  return series;
}

function seriesValue(series, name, i) {
  if (name === 'close') return series.close[i];
  return series[name] ? series[name][i] : null;
}

function evaluateCondition(cond, series, i) {
  const fast = cond.fast || 'sma_fast';
  const slow = cond.slow || 'sma_slow';
  const ind = cond.indicator || 'sma_fast';

  switch (cond.type) {
    case 'crossover': {
      if (i < 1) return false;
      const fPrev = seriesValue(series, fast, i - 1);
      const sPrev = seriesValue(series, slow, i - 1);
      const fNow = seriesValue(series, fast, i);
      const sNow = seriesValue(series, slow, i);
      return fPrev != null && sPrev != null && fNow != null && sNow != null &&
        fPrev <= sPrev && fNow > sNow;
    }
    case 'crossunder': {
      if (i < 1) return false;
      const fPrev = seriesValue(series, fast, i - 1);
      const sPrev = seriesValue(series, slow, i - 1);
      const fNow = seriesValue(series, fast, i);
      const sNow = seriesValue(series, slow, i);
      return fPrev != null && sPrev != null && fNow != null && sNow != null &&
        fPrev >= sPrev && fNow < sNow;
    }
    case 'above': {
      const v = seriesValue(series, ind, i);
      return v != null && v > (cond.value ?? 0);
    }
    case 'below': {
      const v = seriesValue(series, ind, i);
      return v != null && v < (cond.value ?? 0);
    }
    case 'always':
      return true;
    default:
      return false;
  }
}

function evaluateAll(conditions, series, i) {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((cond) => evaluateCondition(cond, series, i));
}

// Produces a signal at the latest bar only.
function checkSignal(candles, strategy) {
  const rules = strategy.rules || {};
  const series = buildSeries(candles, rules);
  const i = candles.length - 1;
  if (i < 1) return { signal: 'WAIT' };
  const last = candles[i];
  const indicators = {
    close: last.close,
    sma_fast: series.sma_fast[i],
    sma_slow: series.sma_slow[i],
    rsi: series.rsi[i],
  };

  const buy = evaluateAll(rules.buyConditions, series, i);
  const sell = evaluateAll(rules.sellConditions, series, i);

  if (buy && !sell) return { signal: 'BUY', indicators, ts: last.ts };
  if (sell && !buy) return { signal: 'SELL', indicators, ts: last.ts };
  return { signal: 'WAIT', indicators, ts: last.ts };
}

// Walks candles applying conditions plus stop-loss / take-profit, and returns
// closed trades, metrics and an equity curve.
function backtest(candles, strategy, opts = {}) {
  const rules = strategy.rules || {};
  const risk = strategy.risk || {};
  const initialCapital = opts.initialCapital || 10000;
  const series = buildSeries(candles, rules);

  const slowPeriod = (rules.indicators && rules.indicators.sma_slow) || 50;
  const start = Math.max(slowPeriod + 5, 2);

  let cash = initialCapital;
  let position = null; // { entryPrice, entryTime, quantity }
  const trades = [];
  const equityCurve = [];
  let peak = initialCapital;
  let maxDrawdown = 0;

  const openLong = (i) => {
    const price = candles[i].close;
    const qty = (risk.positionSize || 1000) / price;
    cash -= qty * price;
    position = { entryPrice: price, entryTime: candles[i].ts, quantity: qty, entryIndex: i };
  };

  const closeLong = (i, price, reason) => {
    const proceeds = position.quantity * price;
    cash += proceeds;
    const pnl = proceeds - position.quantity * position.entryPrice;
    trades.push({
      entryTime: position.entryTime, exitTime: candles[i].ts,
      entryPrice: position.entryPrice, exitPrice: price,
      quantity: position.quantity, pnl, reason,
    });
    position = null;
  };

  for (let i = start; i < candles.length; i++) {
    const bar = candles[i];

    if (position) {
      const sl = position.entryPrice * (1 - (risk.stopLossPct || 0) / 100);
      const tp = position.entryPrice * (1 + (risk.takeProfitPct || 0) / 100);
      if (bar.low <= sl) closeLong(i, sl, 'STOP_LOSS');
      else if (bar.high >= tp) closeLong(i, tp, 'TAKE_PROFIT');
      else if (evaluateAll(rules.sellConditions, series, i)) closeLong(i, bar.close, 'SIGNAL');
    }

    if (!position && evaluateAll(rules.buyConditions, series, i)) {
      openLong(i);
    }

    const equity = cash + (position ? position.quantity * bar.close : 0);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100);
    equityCurve.push({ i, ts: bar.ts, equity: Math.round(equity * 100) / 100 });
  }

  // close any remaining position at the last close (mark to market)
  if (position) {
    closeLong(candles.length - 1, candles[candles.length - 1].close, 'END');
  }

  const finalEquity = cash;
  const totalReturnPct = ((finalEquity - initialCapital) / initialCapital) * 100;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const returns = trades.map((t) => t.pnl / (t.quantity * t.entryPrice));

  return {
    symbol: strategy.symbol,
    timeframe: strategy.timeframe,
    initialCapital,
    finalEquity: Math.round(finalEquity * 100) / 100,
    totalReturnPct: Math.round(totalReturnPct * 100) / 100,
    numTrades: trades.length,
    winRate: trades.length ? Math.round((wins.length / trades.length) * 100) : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
    avgWinPct: wins.length
      ? wins.reduce((a, t) => a + (t.pnl / (t.quantity * t.entryPrice)) * 100, 0) / wins.length
      : 0,
    avgLossPct: losses.length
      ? losses.reduce((a, t) => a + (t.pnl / (t.quantity * t.entryPrice)) * 100, 0) / losses.length
      : 0,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpe: returns.length
      ? (avg(returns) / Math.sqrt(variance(returns)) || 0)
      : 0,
    trades,
    equityCurve,
  };
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function variance(arr) {
  const m = avg(arr);
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
}

module.exports = { checkSignal, backtest, buildSeries, evaluateCondition };
