const express = require('express');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /alerts
router.get('/', async (req, res, next) => {
  try {
    const store = await getStore();
    res.json(await store.listAlerts(req.user.id));
  } catch (err) {
    next(err);
  }
});

// POST /alerts  { symbol, type: price|indicator, condition: {...} }
router.post('/', async (req, res, next) => {
  try {
    const { symbol, type, condition } = req.body;
    if (!symbol || !type || !condition) {
      return res.status(400).json({ error: 'symbol, type and condition are required' });
    }
    const store = await getStore();
    const alert = await store.createAlert({ user_id: req.user.id, symbol, type, condition });
    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
});

// PATCH /alerts/:id  { active }
router.patch('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const alert = await store.updateAlert(req.params.id, { active: req.body.active ? 1 : 0 });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

// DELETE /alerts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    await store.deleteAlert(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;