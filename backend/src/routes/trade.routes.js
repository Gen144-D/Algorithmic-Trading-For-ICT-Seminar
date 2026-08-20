const express = require('express');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { getQuote } = require('../services/market');

const router = express.Router();
router.use(authRequired);

router.get('/trades', async (req, res, next) => {
  try {
    const store = await getStore();
    const trades = await store.listTrades(req.user.id);
    res.json(trades);
  } catch (err) {
    next(err);
  }
});

// Portfolio: cash balance, open positions marked to market, realized P/L.
router.get('/portfolio', async (req, res, next) => {
  try {
    const store = await getStore();
    const user = await store.findUserById(req.user.id);
    const open = await store.openTrades(req.user.id);
    const all = await store.listTrades(req.user.id);
    const closed = all.filter((t) => t.status === 'CLOSED');

    const positions = [];
    let unrealizedPnl = 0;
    for (const pos of open) {
      const quote = await getQuote(pos.symbol);
      const price = quote ? quote.price : pos.entry_price || pos.price;
      const pnl = (price - (pos.entry_price || pos.price)) * pos.quantity;
      unrealizedPnl += pnl;
      positions.push({ ...pos, currentPrice: price, unrealizedPnl: pnl });
    }

    const realizedPnl = closed.reduce((a, t) => a + Number(t.pnl || 0), 0);
    const equity = Number(user.balance) + unrealizedPnl;
    const peak = Number(user.peak_equity) || equity;
    const drawdownPct = peak > 0 ? Math.max(0, ((peak - equity) / peak) * 100) : 0;

    res.json({
      balance: user.balance,
      equity,
      unrealizedPnl,
      realizedPnl,
      drawdownPct: Math.round(drawdownPct * 100) / 100,
      peakEquity: peak,
      positions,
      closedTrades: closed.slice(-50).reverse(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const store = await getStore();
    const logs = await store.listLogs(req.user.id);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
