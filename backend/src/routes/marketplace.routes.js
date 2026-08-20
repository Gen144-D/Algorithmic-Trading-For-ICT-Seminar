const express = require('express');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /marketplace
router.get('/', async (req, res, next) => {
  try {
    const store = await getStore();
    const items = await store.listMarketplaceItems(Number(req.query.limit) || 50);
    const out = [];
    for (const item of items) {
      out.push({ ...item, installed: await store.hasInstalled(req.user.id, item.id) });
    }
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// GET /marketplace/:id
router.get('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const item = await store.getMarketplaceItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ ...item, installed: await store.hasInstalled(req.user.id, item.id) });
  } catch (err) {
    next(err);
  }
});

// POST /marketplace/:id/install — copies rules into the user's strategy + bot
router.post('/:id/install', async (req, res, next) => {
  try {
    const store = await getStore();
    const item = await store.getMarketplaceItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (await store.hasInstalled(req.user.id, item.id)) {
      return res.status(409).json({ error: 'Item already installed' });
    }
    const strategy = await store.createStrategy({
      user_id: req.user.id,
      name: item.name,
      symbol: item.symbol,
      timeframe: item.timeframe,
      rules: item.rules,
      risk: item.risk,
    });
    const bot = await store.createBot({
      user_id: req.user.id,
      strategy_id: strategy.id,
      name: `${item.name} Bot`,
      mode: 'paper',
      status: 'DRAFT',
      config: {},
      source: 'marketplace',
      marketplace_item_id: item.id,
    });
    await store.recordInstall(req.user.id, item.id, bot.id);
    await store.addLog(req.user.id, 'MARKETPLACE_INSTALL', { name: item.name });
    res.status(201).json({ strategy, bot });
  } catch (err) {
    next(err);
  }
});

// POST /marketplace — publish a bot (creator feature)
router.post('/', async (req, res, next) => {
  try {
    const { name, description, symbol, timeframe, rules, risk, price = 0 } = req.body;
    if (!name || !symbol || !timeframe || !rules) {
      return res.status(400).json({ error: 'name, symbol, timeframe and rules are required' });
    }
    const store = await getStore();
    const item = await store.createMarketplaceItem({
      creator_id: req.user.id,
      name,
      description,
      symbol,
      timeframe,
      rules,
      risk: risk || {},
      price,
      is_free: price <= 0,
    });
    await store.addLog(req.user.id, 'MARKETPLACE_PUBLISH', { name: item.name });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

module.exports = router;