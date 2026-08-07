const { getStore } = require('../config/db');

const TIMEFRAMES = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'SPY', 'BTC', 'ETH'];

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic synthetic candles so backtests are repeatable per symbol/timeframe.
function generateSynthetic(symbol, timeframe, count = 300) {
  const step = TIMEFRAMES[timeframe] || 60 * 60 * 1000;
  const rng = mulberry32(hashSeed(`${symbol}:${timeframe}:seed`));
  const vol = 0.02;
  let close = 50 + rng() * 150;
  const rows = [];
  const end = Math.floor(Date.now() / step) * step;
  for (let i = count - 1; i >= 0; i--) {
    const ts = new Date(end - i * step);
    const open = close;
    const chg = (rng() + rng() + rng() - 1.5) * vol * open;
    close = Math.max(open + chg, 1);
    const high = Math.max(open, close) * (1 + rng() * 0.005);
    const low = Math.min(open, close) * (1 - rng() * 0.005);
    const volume = Math.floor(rng() * 20000) + 1000;
    rows.push({ ts: ts.toISOString(), open, high, low, close, volume });
  }
  return rows;
}

async function fetchExternal(symbol, timeframe) {
  const key = process.env.MARKET_DATA_API_KEY;
  const base = process.env.MARKET_DATA_API_BASE || 'https://api.twelvedata.com';
  if (!key) return null;
  const intervalMap = {
    '1m': '1min', '5m': '5min', '15m': '15min', '1h': '1hour', '4h': '4hour', '1d': '1day',
  };
  try {
    const url = `${base}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${intervalMap[timeframe]}&outputsize=300&apikey=${key}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (!json.values) return null;
    return json.values.reverse().map((v) => ({
      ts: new Date(v.datetime).toISOString(),
      open: Number(v.open), high: Number(v.high), low: Number(v.low),
      close: Number(v.close), volume: Number(v.volume) || 0,
    }));
  } catch {
    return null;
  }
}

async function getCandles(symbol, timeframe = '1h', count = 300, opts = {}) {
  const store = await getStore();
  const external = await fetchExternal(symbol, timeframe);
  if (external && external.length) {
    await store.saveCandles(symbol, timeframe, external);
    return external.slice(-count);
  }

  let rows = await store.getCandles(symbol, timeframe, count);
  if (rows.length < count) {
    rows = generateSynthetic(symbol, timeframe, count);
    await store.saveCandles(symbol, timeframe, rows);
  }
  rows = rows.slice(-count);

  // Live-tick mode: the trading engine advances a compressed-time series so
  // signals can actually fire during a demo. Each tick appends a few new bars.
  if (opts.live) return getLiveCandles(symbol, timeframe, count);
  return rows;
}

// Per-process evolving series for the automated engine. Initialized from the
// synthetic base, then advanced a few bars every engine tick.
const liveSeries = new Map();

function getLiveCandles(symbol, timeframe, count) {
  const key = `${symbol}:${timeframe}`;
  const step = TIMEFRAMES[timeframe] || 60 * 60 * 1000;
  if (!liveSeries.has(key)) {
    liveSeries.set(key, {
      candles: generateSynthetic(symbol, timeframe, 400),
      rng: mulberry32(hashSeed(`${key}:livewalk`)),
    });
  }
  const state = liveSeries.get(key);
  const barsPerTick = Number(process.env.LIVE_BARS_PER_TICK || 40);
  let prev = state.candles[state.candles.length - 1].close;
  const now = Date.now();
  for (let b = 0; b < barsPerTick; b++) {
    const ts = new Date(now - (barsPerTick - 1 - b) * step).toISOString();
    const open = prev;
    const chg = (state.rng() + state.rng() + state.rng() - 1.5) * 0.02 * open;
    const close = Math.max(open + chg, 1);
    const high = Math.max(open, close) * (1 + state.rng() * 0.004);
    const low = Math.min(open, close) * (1 - state.rng() * 0.004);
    const volume = Math.floor(state.rng() * 20000) + 1000;
    state.candles.push({ ts, open, high, low, close, volume });
    prev = close;
  }
  if (state.candles.length > 400) state.candles = state.candles.slice(-400);
  return state.candles.slice(-count).map((c) => ({ ...c }));
}

async function getQuote(symbol) {
  const candles = await getCandles(symbol, '1h', 1);
  const last = candles[candles.length - 1];
  return last
    ? { symbol, price: last.close, change: ((last.close - last.open) / last.open) * 100, ts: last.ts }
    : null;
}

module.exports = { getCandles, getQuote, generateSynthetic, SYMBOLS, TIMEFRAMES };
