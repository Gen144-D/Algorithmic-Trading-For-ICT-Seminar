const express = require('express');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { backtest, optimize, walkForward } = require('../modules/engine');
const { getCandles } = require('../services/market');

const router = express.Router();
router.use(authRequired);

// POST /backtest  { strategyId, initialCapital, feePct, slippagePct, allowShort }
router.post('/', async (req, res, next) => {
  try {
    const { strategyId, initialCapital, feePct, slippagePct, allowShort } = req.body;
    if (!strategyId) return res.status(400).json({ error: 'strategyId is required' });
    const store = await getStore();
    const strategy = await store.getStrategy(strategyId);
    if (!strategy || strategy.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    const candles = await getCandles(strategy.symbol, strategy.timeframe, 400);
    const result = backtest(candles, strategy, {
      initialCapital: initialCapital || 10000,
      feePct: Number(feePct || 0),
      slippagePct: Number(slippagePct || 0),
      allowShort: Boolean(allowShort),
    });
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

// POST /backtest/optimize  { strategyId, paramSpace, initialCapital }
// paramSpace: { sma_fast: [5,10,20], sma_slow: [50,100], ... }
router.post('/optimize', async (req, res, next) => {
  try {
    const { strategyId, paramSpace, initialCapital, feePct, slippagePct } = req.body;
    if (!strategyId || !paramSpace) {
      return res.status(400).json({ error: 'strategyId and paramSpace are required' });
    }
    const store = await getStore();
    const strategy = await store.getStrategy(strategyId);
    if (!strategy || strategy.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    const candles = await getCandles(strategy.symbol, strategy.timeframe, 400);
    const results = optimize(candles, strategy, paramSpace, {
      initialCapital: initialCapital || 10000,
      feePct: Number(feePct || 0),
      slippagePct: Number(slippagePct || 0),
    });
    const top = results.slice(0, 20);
    const record = await store.createOptimization({
      user_id: req.user.id,
      strategy_id: strategy.id,
      symbol: strategy.symbol,
      timeframe: strategy.timeframe,
      param_space: paramSpace,
      results: top.map((r) => ({ params: r.params, metrics: summarize(r.result) })),
    });
    await store.addLog(req.user.id, 'OPTIMIZATION_RUN', {
      name: strategy.name, combos: results.length,
    });
    res.json({ id: record.id, top, results: top });
  } catch (err) {
    next(err);
  }
});

// POST /backtest/walk-forward  { strategyId, paramSpace }
router.post('/walk-forward', async (req, res, next) => {
  try {
    const { strategyId, paramSpace, initialCapital } = req.body;
    if (!strategyId || !paramSpace) {
      return res.status(400).json({ error: 'strategyId and paramSpace are required' });
    }
    const store = await getStore();
    const strategy = await store.getStrategy(strategyId);
    if (!strategy || strategy.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    const candles = await getCandles(strategy.symbol, strategy.timeframe, 500);
    const wf = walkForward(candles, strategy, paramSpace, { initialCapital: initialCapital || 10000 });
    await store.addLog(req.user.id, 'WALK_FORWARD_RUN', {
      name: strategy.name,
      inSample: wf.inSample[0]?.result?.totalReturnPct,
      outOfSample: wf.outOfSample[0]?.result?.totalReturnPct,
    });
    res.json(wf);
  } catch (err) {
    next(err);
  }
});

// GET /backtest
router.get('/', async (req, res, next) => {
  try {
    const store = await getStore();
    const backtests = await store.listBacktests(req.user.id);
    res.json(backtests);
  } catch (err) {
    next(err);
  }
});

// GET /backtest/:id
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

function summarize(r) {
  return {
    totalReturnPct: r.totalReturnPct,
    annualizedReturnPct: r.annualizedReturnPct,
    numTrades: r.numTrades,
    winRate: r.winRate,
    profitFactor: r.profitFactor,
    maxDrawdown: r.maxDrawdown,
    sharpe: r.sharpe,
    sortino: r.sortino,
  };
}

module.exports = router;