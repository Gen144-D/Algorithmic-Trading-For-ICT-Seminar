const express = require('express');
const { getCandles, getQuote, SYMBOLS, TIMEFRAMES } = require('../services/market');

const router = express.Router();

router.get('/symbols', (req, res) => {
  res.json({ symbols: SYMBOLS, timeframes: Object.keys(TIMEFRAMES) });
});

router.get('/candles', async (req, res, next) => {
  try {
    const { symbol = 'AAPL', timeframe = '1h' } = req.query;
    const count = Math.min(Number(req.query.count) || 200, 500);
    const candles = await getCandles(symbol.toUpperCase(), timeframe, count);
    res.json({ symbol: symbol.toUpperCase(), timeframe, candles });
  } catch (err) {
    next(err);
  }
});

router.get('/quotes', async (req, res, next) => {
  try {
    const quotes = [];
    for (const symbol of SYMBOLS) {
      const quote = await getQuote(symbol);
      if (quote) quotes.push(quote);
    }
    res.json({ quotes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
