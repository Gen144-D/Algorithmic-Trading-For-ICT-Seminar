const express = require('express');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const store = await getStore();
    const strategies = await store.listStrategies(req.user.id);
    res.json(strategies);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, symbol, timeframe, rules, risk } = req.body;
    if (!name || !symbol || !timeframe || !rules) {
      return res.status(400).json({ error: 'name, symbol, timeframe and rules are required' });
    }
    const store = await getStore();
    const strategy = await store.createStrategy({
      user_id: req.user.id, name, symbol, timeframe,
      rules, risk: risk || {},
    });
    await store.addLog(req.user.id, 'STRATEGY_CREATED', { name: strategy.name, symbol });
    res.status(201).json(strategy);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const strategy = await store.getStrategy(req.params.id);
    if (!strategy || strategy.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    res.json(strategy);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const existing = await store.getStrategy(req.params.id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    const fields = {};
    for (const key of ['name', 'symbol', 'timeframe', 'rules', 'risk']) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    const strategy = await store.updateStrategy(req.params.id, fields);
    await store.addLog(req.user.id, 'STRATEGY_UPDATED', { name: strategy.name });
    res.json(strategy);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const existing = await store.getStrategy(req.params.id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    await store.deleteStrategy(req.params.id);
    await store.addLog(req.user.id, 'STRATEGY_DELETED', { name: existing.name });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/activate', async (req, res, next) => {
  try {
    const store = await getStore();
    const existing = await store.getStrategy(req.params.id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    const active = req.body.active ? 1 : 0;
    if (active) {
      const rules = existing.rules || {};
      const buy = Array.isArray(rules.buyConditions) ? rules.buyConditions : [];
      const sell = Array.isArray(rules.sellConditions) ? rules.sellConditions : [];
      if (!buy.length || !sell.length) {
        return res.status(400).json({
          error: 'Cannot activate: strategy needs at least one buy and one sell condition',
        });
      }
    }
    const strategy = await store.updateStrategy(req.params.id, { active });

    // Keep a bot in sync so the engine can execute this strategy.
    let bot = await store.botForStrategy(req.user.id, existing.id);
    if (active) {
      if (!bot) {
        bot = await store.createBot({
          user_id: req.user.id,
          strategy_id: existing.id,
          name: `${existing.name} Bot`,
          mode: 'paper',
          status: 'RUNNING',
          config: {},
        });
      } else if (bot.status !== 'RUNNING') {
        bot = await store.updateBot(bot.id, { status: 'RUNNING' });
      }
    } else if (bot) {
      bot = await store.updateBot(bot.id, { status: 'STOPPED' });
    }

    await store.addLog(req.user.id, active ? 'STRATEGY_ACTIVATED' : 'STRATEGY_DEACTIVATED', {
      name: strategy.name,
    });
    res.json({ ...strategy, bot });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
