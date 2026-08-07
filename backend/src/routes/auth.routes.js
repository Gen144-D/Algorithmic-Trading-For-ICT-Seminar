const express = require('express');
const bcrypt = require('bcryptjs');
const { getStore } = require('../config/db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    const store = await getStore();
    if (await store.findUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await store.createUser({ name, email, passwordHash });
    const token = signToken({ id: user.id, email: user.email });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, balance: user.balance } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const store = await getStore();
    const user = await store.findUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ id: user.id, email: user.email });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, balance: user.balance } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const store = await getStore();
    const user = await store.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, name: user.name, email: user.email, balance: user.balance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
