// Thin JS bridge so existing consumers (routes, engine) use the TypeScript
// market service. Delegates to src/modules/market/service.ts.

const { getStore } = require('../config/db');

let svc = null;
async function getService() {
  if (svc) return svc;
  const store = await getStore();
  const { createMarketService } = require('../modules/market/service');
  svc = createMarketService({ store });
  return svc;
}

async function getCandles(symbol, timeframe = '1h', count = 300, opts = {}) {
  const s = await getService();
  return s.getCandles(symbol, timeframe, count, opts);
}

async function getQuote(symbol) {
  const s = await getService();
  return s.getQuote(symbol);
}

module.exports = {
  getCandles,
  getQuote,
  async symbols() {
    const s = await getService();
    return { symbols: s.symbols, timeframes: Object.keys(s.timeframes) };
  },
};

// Re-exported constants for existing call sites.
const service = require('../modules/market/service');
const synthetic = require('../modules/market/synthetic');
module.exports.SYMBOLS = service.SYMBOLS;
module.exports.TIMEFRAMES = service.TIMEFRAMES;
module.exports.generateSynthetic = synthetic.generateSynthetic;
