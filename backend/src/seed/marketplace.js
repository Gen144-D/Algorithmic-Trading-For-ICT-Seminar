// Seeds the bot marketplace with a few curated free bots on first boot.

const { getStore } = require('../config/db');

const SEED = [
  {
    name: 'BTC Trend Rider',
    description: 'Golden-cross trend following on BTC with an RSI filter. Low frequency, medium risk.',
    symbol: 'BTC',
    timeframe: '4h',
    rules: {
      indicators: { ema_fast: 20, ema_slow: 50, rsi_period: 14 },
      buyConditions: [
        { type: 'crossover', fast: 'ema_fast', slow: 'ema_slow' },
        { type: 'above', indicator: 'rsi', value: 45 },
      ],
      sellConditions: [
        { type: 'crossunder', fast: 'ema_fast', slow: 'ema_slow' },
        { type: 'below', indicator: 'rsi', value: 55 },
      ],
    },
    risk: { stopLossPct: 3, takeProfitPct: 8, positionSize: 1000, maxOpenTrades: 1, trailingStopPct: 2 },
  },
  {
    name: 'S&P Mean Reversion',
    description: 'Buys bollinger-band dips on SPY and fades the move back to the middle band.',
    symbol: 'SPY',
    timeframe: '1h',
    rules: {
      indicators: { boll_period: 20, boll_mult: 2, rsi_period: 14 },
      buyConditions: [{ type: 'band_below' }, { type: 'below', indicator: 'rsi', value: 35 }],
      sellConditions: [{ type: 'above', indicator: 'boll_middle', value: 0 }, { type: 'above', indicator: 'rsi', value: 50 }],
    },
    risk: { stopLossPct: 2, takeProfitPct: 4, positionSize: 1000, maxOpenTrades: 2 },
  },
  {
    name: 'EUR/USD Momentum',
    description: 'Momentum breakout strategy on the euro/dollar pair. Low risk.',
    symbol: 'EURUSD',
    timeframe: '1h',
    rules: {
      indicators: { sma_fast: 10, sma_slow: 30, rsi_period: 14, momentum_period: 8 },
      buyConditions: [
        { type: 'crossover', fast: 'sma_fast', slow: 'sma_slow' },
        { type: 'above', indicator: 'momentum', value: 0.2 },
      ],
      sellConditions: [
        { type: 'crossunder', fast: 'sma_fast', slow: 'sma_slow' },
        { type: 'below', indicator: 'momentum', value: -0.2 },
      ],
    },
    risk: { stopLossPct: 1.5, takeProfitPct: 3, riskPerTradePct: 1, maxOpenTrades: 1 },
  },
  {
    name: 'ETH MACD Scalper',
    description: 'MACD histogram momentum scalps on ETH with tight stops.',
    symbol: 'ETH',
    timeframe: '15m',
    rules: {
      indicators: { macd_fast: 8, macd_slow: 21, macd_signal: 5 },
      buyConditions: [{ type: 'histogram_above', value: 0 }, { type: 'crossover', fast: 'macd', slow: 'macd_signal' }],
      sellConditions: [{ type: 'histogram_below', value: 0 }, { type: 'crossunder', fast: 'macd', slow: 'macd_signal' }],
    },
    risk: { stopLossPct: 1.2, takeProfitPct: 2.5, positionSize: 800, maxOpenTrades: 3 },
  },
];

async function seedMarketplace() {
  try {
    const store = await getStore();
    const items = await store.listMarketplaceItems(1);
    if (items.length > 0) return;
    for (const item of SEED) {
      await store.createMarketplaceItem({ ...item, price: 0, is_free: 1 });
    }
    console.log(`[seed] marketplace seeded with ${SEED.length} free bots`);
  } catch (err) {
    console.warn('[seed] marketplace seed skipped:', err.message);
  }
}

module.exports = { seedMarketplace, SEED };