const express = require('express');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /journal?tradeId=... — notes for a user (optionally for one trade)
router.get('/', async (req, res, next) => {
  try {
    const store = await getStore();
    const notes = await store.listJournalNotes(req.user.id);
    const filtered = req.query.tradeId
      ? notes.filter((n) => n.trade_id === req.query.tradeId)
      : notes;
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

// POST /journal  { tradeId, note }
router.post('/', async (req, res, next) => {
  try {
    const { tradeId, note } = req.body;
    if (!tradeId || !note) return res.status(400).json({ error: 'tradeId and note are required' });
    const store = await getStore();
    const noteRow = await store.addJournalNote(req.user.id, tradeId, note);
    res.status(201).json(noteRow);
  } catch (err) {
    next(err);
  }
});

module.exports = router;