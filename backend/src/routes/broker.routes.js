// Broker connection routes — manage connections (encrypted credentials,
// scoped permissions, paper/live mode, live kill-switch) and test connectivity.

const express = require('express');
const crypto = require('crypto');
const { getStore } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const ENC_KEY = process.env.BROKER_ENC_KEY || 'dev-broker-enc-key-do-not-use';

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(ENC_KEY).digest(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${enc.toString('base64')}.${cipher.getAuthTag().toString('base64')}`;
}

function decrypt(payload) {
  const [ivB64, dataB64, tagB64] = payload.split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    crypto.createHash('sha256').update(ENC_KEY).digest(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

// GET /brokers
router.get('/', async (req, res, next) => {
  try {
    const store = await getStore();
    res.json(await store.listBrokerConnections(req.user.id));
  } catch (err) {
    next(err);
  }
});

// POST /brokers — { broker: 'alpaca', label, mode, permissions, credentials: {apiKey, secretKey} }
router.post('/', async (req, res, next) => {
  try {
    const { broker, label, mode = 'paper', permissions, credentials } = req.body;
    if (!broker) return res.status(400).json({ error: 'broker is required' });
    const store = await getStore();
    const credentialsEnc = credentials ? encrypt(JSON.stringify(credentials)) : null;
    const conn = await store.createBrokerConnection({
      user_id: req.user.id,
      broker,
      label,
      credentials_enc: credentialsEnc,
      permissions: permissions || { read: true, trade: false, marketData: true },
      mode,
    });
    res.status(201).json(conn);
  } catch (err) {
    next(err);
  }
});

// POST /brokers/:id/test — try to connect to the broker
router.post('/:id/test', async (req, res, next) => {
  try {
    const store = await getStore();
    const conn = await store.getBrokerConnection(req.params.id);
    if (!conn || conn.user_id !== req.user.id) return res.status(404).json({ error: 'Connection not found' });
    let status = 'error';
    let detail = null;
    try {
      const { createAdapter } = require('../modules/broker');
      const creds = conn.credentials_enc ? JSON.parse(decrypt(conn.credentials_enc)) : {};
      const adapter = createAdapter(conn.broker, creds, conn.mode);
      await adapter.connect();
      status = 'connected';
      detail = await adapter.getAccount();
    } catch (err) {
      detail = err.message;
    }
    const updated = await store.updateBrokerConnection(conn.id, { status });
    res.json({ ...updated, testDetail: detail });
  } catch (err) {
    next(err);
  }
});

// PATCH /brokers/:id — toggle live_enabled, permissions, label
router.patch('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    const conn = await store.getBrokerConnection(req.params.id);
    if (!conn || conn.user_id !== req.user.id) return res.status(404).json({ error: 'Connection not found' });
    const fields = {};
    if (req.body.live_enabled !== undefined) fields.live_enabled = req.body.live_enabled ? 1 : 0;
    if (req.body.permissions !== undefined) fields.permissions = req.body.permissions;
    if (req.body.label !== undefined) fields.label = req.body.label;
    const updated = await store.updateBrokerConnection(conn.id, fields);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /brokers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const store = await getStore();
    await store.deleteBrokerConnection(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;