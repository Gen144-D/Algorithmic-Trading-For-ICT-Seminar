const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function proxy(path, body) {
  const resp = await fetch(`${AI_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(json.detail || 'AI service error'), { status: resp.status });
  return json;
}

// POST /ai/analyze/market  { symbol, candles, indicators? }
router.post('/analyze/market', async (req, res, next) => {
  try {
    res.json(await proxy('/analyze/market', req.body));
  } catch (err) {
    next(err);
  }
});

// POST /ai/analyze/strategy  { strategy, backtestResult }
router.post('/analyze/strategy', async (req, res, next) => {
  try {
    res.json(await proxy('/analyze/strategy', req.body));
  } catch (err) {
    next(err);
  }
});

// POST /ai/chat  { message, context? }
router.post('/chat', async (req, res, next) => {
  try {
    res.json(await proxy('/chat', req.body));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
