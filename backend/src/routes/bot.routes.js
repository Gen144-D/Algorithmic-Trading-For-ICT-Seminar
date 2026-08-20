const express = require('express');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { riskEngine } = require('../modules/risk');

const router = express.Router();
router.use(authRequired);

const STATUS_OK = (bot) => {
  const valid = ['DRAFT', 'READY', 'RUNNING', 'PAUSED', 'ERROR', 'STOPPED'];
  return valid.includes(bot.status);
};

// GET /bots — list with strategy details
router.get('/', async (req, res, next) => {
  try {
    const store = await getStore();
    const bots = await store.listBots(req.user.id);
    const out = [];
    for (const b of bots) {
      const strategy = await store.getStrategy(b.strategy_id);
      out.push({ ...b, strategy });
    }
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// POST /bots — create a bot wrapping an existing strategy
router.post('/', async (req, res, next) => {
  try {
    const { strategyId, name, mode = 'paper', config = {} } = req.body;
    if (!strategyId) return res.status(400).json({ error: 'strategyId is required' });
    const store = await getStore();
    const strategy = await store.getStrategy(strategyId);
    if (!strategy || strategy.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    const existing = await store.botForStrategy(req.user.id, strategyId);
    if (existing) return res.status(409).json({ error: 'A bot already exists for this strategy' });
    const bot = await store.createBot({
      user_id: req.user.id,
      strategy_id: strategyId,
      name: name || `${strategy.name} Bot`,
      mode,
      status: 'DRAFT',
      config,
    });
    await store.addLog(req.user.id, 'BOT_CREATED', { name: bot.name });
    res.status(201).json(bot);
  } catch (err) {
    next(err);
  }
});

// GET /bots/:id
router.get('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const bot = await store.getBot(req.params.id);
    if (!bot || bot.user_id !== req.user.id) return res.status(404).json({ error: 'Bot not found' });
    const strategy = await store.getStrategy(bot.strategy_id);
    res.json({ ...bot, strategy });
  } catch (err) {
    next(err);
  }
});

// PUT /bots/:id — update config/name/mode
router.put('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const bot = await store.getBot(req.params.id);
    if (!bot || bot.user_id !== req.user.id) return res.status(404).json({ error: 'Bot not found' });
    const fields = {};
    for (const key of ['name', 'mode', 'config']) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    const updated = await store.updateBot(req.params.id, fields);
    await store.addLog(req.user.id, 'BOT_UPDATED', { name: updated.name });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /bots/:id/start — transition to RUNNING
router.post('/:id/start', async (req, res, next) => {
  try {
    const store = await getStore();
    const bot = await store.getBot(req.params.id);
    if (!bot || bot.user_id !== req.user.id) return res.status(404).json({ error: 'Bot not found' });
    const strategy = await store.getStrategy(bot.strategy_id);
    const rules = strategy.rules || {};
    const buy = Array.isArray(rules.buyConditions) ? rules.buyConditions : [];
    const sell = Array.isArray(rules.sellConditions) ? rules.sellConditions : [];
    if (!buy.length || !sell.length) {
      return res.status(400).json({ error: 'Bot needs at least one buy and one sell condition' });
    }
    if (bot.mode === 'live') {
      const issues = riskEngine.validateForLive(strategy.risk || {});
      if (issues.length) {
        return res.status(400).json({ error: `Live trading requires: ${issues.join('; ')}` });
      }
    }
    const updated = await store.updateBot(bot.id, { status: 'RUNNING' });
    await store.updateStrategy(strategy.id, { active: 1 });
    await store.addLog(req.user.id, 'BOT_STARTED', { name: bot.name, mode: bot.mode });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /bots/:id/pause
router.post('/:id/pause', async (req, res, next) => {
  try {
    const store = await getStore();
    const bot = await store.getBot(req.params.id);
    if (!bot || bot.user_id !== req.user.id) return res.status(404).json({ error: 'Bot not found' });
    const updated = await store.updateBot(bot.id, { status: 'PAUSED' });
    await store.addLog(req.user.id, 'BOT_PAUSED', { name: bot.name });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /bots/:id/resume
router.post('/:id/resume', async (req, res, next) => {
  try {
    const store = await getStore();
    const bot = await store.getBot(req.params.id);
    if (!bot || bot.user_id !== req.user.id) return res.status(404).json({ error: 'Bot not found' });
    const updated = await store.updateBot(bot.id, { status: 'RUNNING' });
    await store.updateStrategy(bot.strategy_id, { active: 1 });
    await store.addLog(req.user.id, 'BOT_RESUMED', { name: bot.name });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /bots/:id/stop
router.post('/:id/stop', async (req, res, next) => {
  try {
    const store = await getStore();
    const bot = await store.getBot(req.params.id);
    if (!bot || bot.user_id !== req.user.id) return res.status(404).json({ error: 'Bot not found' });
    const updated = await store.updateBot(bot.id, { status: 'STOPPED' });
    await store.updateStrategy(bot.strategy_id, { active: 0 });
    await store.addLog(req.user.id, 'BOT_STOPPED', { name: bot.name });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /bots/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const bot = await store.getBot(req.params.id);
    if (!bot || bot.user_id !== req.user.id) return res.status(404).json({ error: 'Bot not found' });
    await store.deleteBot(bot.id);
    await store.updateStrategy(bot.strategy_id, { active: 0 });
    await store.addLog(req.user.id, 'BOT_DELETED', { name: bot.name });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /bots/:id/performance — trades + realized P/L for this bot
router.get('/:id/performance', async (req, res, next) => {
  try {
    const store = await getStore();
    const bot = await store.getBot(req.params.id);
    if (!bot || bot.user_id !== req.user.id) return res.status(404).json({ error: 'Bot not found' });
    const all = await store.listTrades(req.user.id);
    const trades = all.filter((t) => t.bot_id === bot.id);
    const closed = trades.filter((t) => t.status === 'CLOSED');
    const realized = closed.reduce((a, t) => a + Number(t.pnl || 0), 0);
    const wins = closed.filter((t) => t.pnl > 0).length;
    res.json({
      botId: bot.id,
      totalTrades: trades.length,
      openTrades: trades.filter((t) => t.status === 'OPEN').length,
      closedTrades: closed.length,
      realizedPnl: realized,
      winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
      trades: closed.slice(-25).reverse(),
    });
  } catch (err) {
    next(err);
  }
});

void STATUS_OK;
module.exports = router;