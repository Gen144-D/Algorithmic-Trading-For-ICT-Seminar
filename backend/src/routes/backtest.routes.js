const express = require('express');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { backtest } = require('../services/engine');
const { getCandles } = require('../services/market');

const router = express.Router();
router.use(authRequired);

router.post('/', async (req, res, next) => {
  try {
    const { strategyId, initialCapital } = req.body;
    if (!strategyId) return res.status(400).json({ error: 'strategyId is required' });
    const store = await getStore();
    const strategy = await store.getStrategy(strategyId);
    if (!strategy || strategy.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    const candles = await getCandles(strategy.symbol, strategy.timeframe, 300);
    const result = backtest(candles, strategy, { initialCapital: initialCapital || 10000 });
    const record = await store.createBacktest({
      user_id: req.user.id,
      strategy_id: strategy.id,
      symbol: strategy.symbol,
      timeframe: strategy.timeframe,
      result,
    });
    await store.addLog(req.user.id, 'BACKTEST_RUN', {
      name: strategy.name, symbol: strategy.symbol,
      pnl: result.totalReturnPct,
    });
    res.json({ id: record.id, ...record, result });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const store = await getStore();
    const backtests = await store.listBacktests(req.user.id);
    res.json(backtests);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const b = await store.getBacktest(req.params.id);
    if (!b || b.user_id !== req.user.id) return res.status(404).json({ error: 'Backtest not found' });
    res.json(b);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
