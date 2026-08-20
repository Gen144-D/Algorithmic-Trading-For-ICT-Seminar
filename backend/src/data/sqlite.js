// File-backed store using Node's built-in `node:sqlite` (no external deps).
// Used as the persistent fallback when MySQL is unavailable. Set SQLITE_PATH
// to ':memory:' for a purely in-memory store.

const { DatabaseSync } = require('node:sqlite');
const { v4: uuid } = require('uuid');
const path = require('path');
const fs = require('fs');

function createSqliteStore() {
  const file = process.env.SQLITE_PATH || path.join(__dirname, '..', '..', 'data', 'trading.db');
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 10000,
      peak_equity REAL NOT NULL DEFAULT 10000,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      experience TEXT,
      risk_profile TEXT,
      preferred_markets TEXT,
      two_factor_secret TEXT,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL DEFAULT '1h',
      rules TEXT NOT NULL,
      risk TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      strategy_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'paper',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      config TEXT,
      source TEXT NOT NULL DEFAULT 'custom',
      marketplace_item_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      strategy_id TEXT,
      bot_id TEXT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      entry_price REAL NOT NULL,
      exit_price REAL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      pnl REAL NOT NULL DEFAULT 0,
      opened_at TEXT,
      closed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backtests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      strategy_id TEXT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS optimizations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      strategy_id TEXT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      param_space TEXT NOT NULL,
      results TEXT NOT NULL,
      walk_forward TEXT,
      created_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS price_history (
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      ts TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL DEFAULT 0,
      UNIQUE(symbol, timeframe, ts)
    );

    CREATE TABLE IF NOT EXISTS marketplace_items (
      id TEXT PRIMARY KEY,
      creator_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      rules TEXT NOT NULL,
      risk TEXT,
      price REAL NOT NULL DEFAULT 0,
      is_free INTEGER NOT NULL DEFAULT 1,
      rating REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      installs INTEGER NOT NULL DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS marketplace_installs (
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      bot_id TEXT,
      created_at TEXT,
      PRIMARY KEY (user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL,
      condition TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      triggered_at TEXT,
      created_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS journal_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      trade_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS broker_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      broker TEXT NOT NULL,
      label TEXT,
      credentials_enc TEXT,
      permissions TEXT,
      mode TEXT NOT NULL DEFAULT 'paper',
      live_enabled INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'disconnected',
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const now = () => new Date().toISOString();

  // parse JSON columns on read
  function fromRow(row) {
    if (!row) return row;
    const out = { ...row };
    for (const key of ['rules', 'risk', 'result', 'config', 'condition', 'permissions', 'param_space', 'results', 'walk_forward', 'preferred_markets', 'detail']) {
      if (typeof out[key] === 'string') {
        try {
          out[key] = JSON.parse(out[key]);
        } catch {
          /* keep raw string */
        }
      }
    }
    return out;
  }
  const fromRows = (rows) => rows.map(fromRow);

  // dynamic update: SET only provided columns, preserving others
  function updateRow(table, id, fields, extra = {}) {
    const allowed = extra.allowed || Object.keys(fields);
    const cols = [];
    const vals = [];
    for (const key of Object.keys(fields)) {
      if (!allowed.includes(key)) continue;
      let v = fields[key];
      if (typeof v === 'object' && v !== null && !(v instanceof Date)) v = JSON.stringify(v);
      cols.push(`${key} = ?`);
      vals.push(v);
    }
    for (const key of Object.keys(extra)) {
      if (key === 'allowed') continue;
      cols.push(`${key} = ?`);
      vals.push(extra[key]);
    }
    if (!cols.length) return null;
    vals.push(id);
    db.prepare(`UPDATE ${table} SET ${cols.join(', ')} WHERE id = ?`).run(...vals);
    return getRow(table, id);
  }
  function getRow(table, id) {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    return row ? fromRow(row) : null;
  }

  return {
    mode: 'sqlite',

    // ---- users ----
    async findUserByEmail(email) {
      const row = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').get(email);
      return fromRow(row);
    },
    async findUserById(id) {
      return getRow('users', id);
    },
    async createUser({ name, email, passwordHash, balance = 10000 }) {
      const id = uuid();
      db.prepare('INSERT INTO users (id, name, email, password_hash, balance, peak_equity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, email, passwordHash, balance, balance, now());
      return getRow('users', id);
    },
    async updateBalance(id, amount) {
      const user = getRow('users', id);
      if (!user) throw new Error('User not found');
      const balance = Math.round((user.balance + amount) * 100) / 100;
      const peak = Math.max(user.peak_equity, balance);
      db.prepare('UPDATE users SET balance = ?, peak_equity = ? WHERE id = ?').run(balance, peak, id);
      return balance;
    },
    async setBalance(id, balance) {
      const user = getRow('users', id);
      if (!user) throw new Error('User not found');
      const peak = Math.max(user.peak_equity, balance);
      db.prepare('UPDATE users SET balance = ?, peak_equity = ? WHERE id = ?').run(balance, peak, id);
      return balance;
    },
    async updatePassword(id, passwordHash) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    },

    // ---- profiles ----
    async getProfile(userId) {
      const row = db.prepare('SELECT * FROM profiles WHERE user_id = ? LIMIT 1').get(userId);
      return fromRow(row);
    },
    async upsertProfile(userId, fields) {
      const existing = await this.getProfile(userId);
      const next = { ...(existing || {}), ...fields, user_id: userId };
      const json = (v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v ?? null);
      if (existing) {
        db.prepare(
          'UPDATE profiles SET experience = ?, risk_profile = ?, preferred_markets = ?, two_factor_secret = ?, two_factor_enabled = ?, updated_at = ? WHERE user_id = ?'
        ).run(
          next.experience ?? null,
          next.risk_profile ?? null,
          json(next.preferred_markets),
          next.two_factor_secret ?? null,
          next.two_factor_enabled ? 1 : 0,
          now(),
          userId
        );
      } else {
        db.prepare(
          'INSERT INTO profiles (user_id, experience, risk_profile, preferred_markets, two_factor_secret, two_factor_enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
          userId,
          next.experience ?? null,
          next.risk_profile ?? null,
          json(next.preferred_markets),
          next.two_factor_secret ?? null,
          next.two_factor_enabled ? 1 : 0,
          now()
        );
      }
      return this.getProfile(userId);
    },

    // ---- refresh tokens ----
    async createRefreshToken({ userId, tokenHash, expiresAt }) {
      const id = uuid();
      db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, 0, ?)')
        .run(id, userId, tokenHash, new Date(expiresAt).toISOString(), now());
      return id;
    },
    async findRefreshToken(tokenHash) {
      const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1').get(tokenHash);
      return fromRow(row);
    },
    async revokeRefreshToken(tokenHash) {
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
    },

    // ---- strategies ----
    async listStrategies(userId) {
      const rows = db.prepare('SELECT * FROM strategies WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return fromRows(rows);
    },
    async getStrategy(id) {
      return getRow('strategies', id);
    },
    async createStrategy({ user_id, name, symbol, timeframe, rules, risk }) {
      const id = uuid();
      db.prepare('INSERT INTO strategies (id, user_id, name, symbol, timeframe, rules, risk, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
        .run(id, user_id, name, symbol, timeframe, JSON.stringify(rules || {}), JSON.stringify(risk || {}), now(), now());
      return getRow('strategies', id);
    },
    async updateStrategy(id, fields) {
      return updateRow('strategies', id, fields, { allowed: ['name', 'symbol', 'timeframe', 'rules', 'risk', 'active'], updated_at: now() });
    },
    async deleteStrategy(id) {
      db.prepare('DELETE FROM strategies WHERE id = ?').run(id);
      return true;
    },
    async activeStrategies() {
      const rows = db.prepare("SELECT * FROM strategies WHERE active = 1").all();
      return fromRows(rows);
    },

    // ---- bots ----
    async listBots(userId) {
      const rows = db.prepare('SELECT * FROM bots WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return fromRows(rows);
    },
    async getBot(id) {
      return getRow('bots', id);
    },
    async createBot({ user_id, strategy_id, name, mode = 'paper', status = 'DRAFT', config = {}, source = 'custom', marketplace_item_id = null }) {
      const id = uuid();
      db.prepare('INSERT INTO bots (id, user_id, strategy_id, name, mode, status, config, source, marketplace_item_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, user_id, strategy_id, name, mode, status, JSON.stringify(config || {}), source, marketplace_item_id, now(), now());
      return getRow('bots', id);
    },
    async updateBot(id, fields) {
      return updateRow('bots', id, fields, { allowed: ['name', 'mode', 'status', 'config', 'source', 'marketplace_item_id'], updated_at: now() });
    },
    async deleteBot(id) {
      db.prepare('DELETE FROM bots WHERE id = ?').run(id);
      return true;
    },
    async botForStrategy(userId, strategyId) {
      const row = db.prepare('SELECT * FROM bots WHERE user_id = ? AND strategy_id = ? LIMIT 1').get(userId, strategyId);
      return fromRow(row);
    },
    async runningBots() {
      const rows = db.prepare("SELECT * FROM bots WHERE status = 'RUNNING'").all();
      return fromRows(rows);
    },

    // ---- trades ----
    async listTrades(userId) {
      const rows = db.prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY opened_at DESC').all(userId);
      return fromRows(rows);
    },
    async openTrades(userId) {
      const rows = db.prepare("SELECT * FROM trades WHERE user_id = ? AND status = 'OPEN'").all(userId);
      return fromRows(rows);
    },
    async createTrade(trade) {
      const id = uuid();
      const t = {
        id,
        status: 'OPEN',
        pnl: 0,
        opened_at: now(),
        closed_at: null,
        entry_price: trade.price,
        exit_price: null,
        bot_id: trade.bot_id || null,
        ...trade,
      };
      db.prepare(
        'INSERT INTO trades (id, user_id, strategy_id, bot_id, symbol, side, quantity, price, entry_price, exit_price, status, pnl, opened_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        t.id, t.user_id, t.strategy_id || null, t.bot_id, t.symbol, t.side, t.quantity,
        t.price, t.entry_price, t.exit_price, t.status, t.pnl, t.opened_at, t.closed_at
      );
      return getRow('trades', id);
    },
    async closeTrade(id, { price, pnl }) {
      const row = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
      if (!row) return null;
      db.prepare("UPDATE trades SET status = 'CLOSED', exit_price = ?, pnl = ?, closed_at = ? WHERE id = ?")
        .run(price, pnl, now(), id);
      return getRow('trades', id);
    },

    // ---- backtests ----
    async createBacktest({ user_id, strategy_id, symbol, timeframe, result }) {
      const id = uuid();
      db.prepare('INSERT INTO backtests (id, user_id, strategy_id, symbol, timeframe, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, user_id, strategy_id || null, symbol, timeframe, JSON.stringify(result), now());
      return getRow('backtests', id);
    },
    async listBacktests(userId) {
      const rows = db.prepare('SELECT * FROM backtests WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return fromRows(rows);
    },
    async getBacktest(id) {
      return getRow('backtests', id);
    },

    // ---- optimizations ----
    async createOptimization({ user_id, strategy_id, symbol, timeframe, param_space, results, walk_forward }) {
      const id = uuid();
      db.prepare('INSERT INTO optimizations (id, user_id, strategy_id, symbol, timeframe, param_space, results, walk_forward, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, user_id, strategy_id || null, symbol, timeframe, JSON.stringify(param_space), JSON.stringify(results), walk_forward ? JSON.stringify(walk_forward) : null, now());
      return getRow('optimizations', id);
    },
    async listOptimizations(userId) {
      const rows = db.prepare('SELECT * FROM optimizations WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return fromRows(rows);
    },

    // ---- candles ----
    async getCandles(symbol, timeframe, limit = 500) {
      const rows = db.prepare(
        'SELECT symbol, timeframe, ts, open, high, low, close, volume FROM price_history WHERE symbol = ? AND timeframe = ? ORDER BY ts ASC LIMIT ?'
      ).all(symbol, timeframe, limit);
      return fromRows(rows);
    },
    async saveCandles(symbol, timeframe, rows) {
      const stmt = db.prepare(
        'INSERT OR REPLACE INTO price_history (symbol, timeframe, ts, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      db.exec('BEGIN');
      try {
        for (const r of rows) {
          stmt.run(symbol, timeframe, r.ts, r.open, r.high, r.low, r.close, r.volume || 0);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },

    // ---- marketplace ----
    async listMarketplaceItems(limit = 50) {
      const rows = db.prepare('SELECT * FROM marketplace_items ORDER BY installs DESC LIMIT ?').all(limit);
      return fromRows(rows);
    },
    async getMarketplaceItem(id) {
      return getRow('marketplace_items', id);
    },
    async createMarketplaceItem({ creator_id, name, description, symbol, timeframe, rules, risk, price = 0, is_free = 1 }) {
      const id = uuid();
      db.prepare('INSERT INTO marketplace_items (id, creator_id, name, description, symbol, timeframe, rules, risk, price, is_free, rating, rating_count, installs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)')
        .run(id, creator_id || null, name, description || null, symbol, timeframe, JSON.stringify(rules || {}), JSON.stringify(risk || {}), price, is_free ? 1 : 0, now());
      return getRow('marketplace_items', id);
    },
    async recordInstall(userId, itemId, botId) {
      const existing = db.prepare('SELECT 1 FROM marketplace_installs WHERE user_id = ? AND item_id = ?').get(userId, itemId);
      if (existing) return;
      db.prepare('INSERT INTO marketplace_installs (user_id, item_id, bot_id, created_at) VALUES (?, ?, ?, ?)').run(userId, itemId, botId, now());
      db.prepare('UPDATE marketplace_items SET installs = installs + 1 WHERE id = ?').run(itemId);
    },
    async hasInstalled(userId, itemId) {
      return !!db.prepare('SELECT 1 FROM marketplace_installs WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    },

    // ---- alerts ----
    async listAlerts(userId) {
      const rows = db.prepare('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return fromRows(rows);
    },
    async createAlert({ user_id, symbol, type, condition }) {
      const id = uuid();
      db.prepare('INSERT INTO alerts (id, user_id, symbol, type, condition, active, triggered_at, created_at) VALUES (?, ?, ?, ?, ?, 1, NULL, ?)')
        .run(id, user_id, symbol, type, JSON.stringify(condition || {}), now());
      return getRow('alerts', id);
    },
    async updateAlert(id, fields) {
      return updateRow('alerts', id, fields, { allowed: ['active', 'triggered_at'] });
    },
    async deleteAlert(id) {
      db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
      return true;
    },

    // ---- journal ----
    async addJournalNote(userId, tradeId, note) {
      const id = uuid();
      db.prepare('INSERT INTO journal_notes (id, user_id, trade_id, note, created_at) VALUES (?, ?, ?, ?, ?)').run(id, userId, tradeId, note, now());
      return getRow('journal_notes', id);
    },
    async listJournalNotes(userId) {
      const rows = db.prepare('SELECT * FROM journal_notes WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return fromRows(rows);
    },

    // ---- broker connections ----
    async listBrokerConnections(userId) {
      const rows = db.prepare('SELECT * FROM broker_connections WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return fromRows(rows);
    },
    async createBrokerConnection({ user_id, broker, label, credentials_enc, permissions, mode = 'paper' }) {
      const id = uuid();
      db.prepare('INSERT INTO broker_connections (id, user_id, broker, label, credentials_enc, permissions, mode, live_enabled, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)')
        .run(id, user_id, broker, label || null, credentials_enc || null, JSON.stringify(permissions || {}), mode, 'disconnected', now(), now());
      return getRow('broker_connections', id);
    },
    async updateBrokerConnection(id, fields) {
      return updateRow('broker_connections', id, fields, { allowed: ['label', 'mode', 'live_enabled', 'status', 'permissions', 'credentials_enc'], updated_at: now() });
    },
    async getBrokerConnection(id) {
      return getRow('broker_connections', id);
    },
    async deleteBrokerConnection(id) {
      db.prepare('DELETE FROM broker_connections WHERE id = ?').run(id);
      return true;
    },

    // ---- logs ----
    async addLog(userId, action, detail = {}) {
      db.prepare('INSERT INTO logs (id, user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(uuid(), userId, action, JSON.stringify(detail || {}), now());
    },
    async listLogs(userId) {
      const rows = db.prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(userId);
      return fromRows(rows);
    },
  };
}

module.exports = { createSqliteStore };