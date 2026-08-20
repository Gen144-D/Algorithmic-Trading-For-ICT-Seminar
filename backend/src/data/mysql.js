const mysql = require('mysql2/promise');
const { v4: uuid } = require('uuid');

// Converts an ISO timestamp (with 'T' and 'Z' separators) into the
// 'YYYY-MM-DD HH:MM:SS' format MySQL DATETIME accepts in strict mode.
function toMysqlTs(ts) {
  if (ts == null) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

async function createMysqlStore() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'trading',
    password: process.env.DB_PASSWORD || 'trading',
    database: process.env.DB_NAME || 'trading',
    waitForConnections: true,
    connectionLimit: 5,
  });

  // verify connection up-front so callers can fall back if it fails
  await pool.query('SELECT 1');

  // self-initialize schema so a manual import of database/schema.sql is optional
  const DDL = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      balance DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
      peak_equity DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS profiles (
      user_id VARCHAR(36) PRIMARY KEY,
      experience VARCHAR(20),
      risk_profile VARCHAR(20),
      preferred_markets JSON,
      two_factor_secret VARCHAR(64),
      two_factor_enabled TINYINT(1) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS strategies (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(150) NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      timeframe VARCHAR(10) NOT NULL DEFAULT '1h',
      rules JSON NOT NULL,
      risk JSON NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS bots (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      strategy_id VARCHAR(36) NOT NULL,
      name VARCHAR(150) NOT NULL,
      mode ENUM('paper','live') NOT NULL DEFAULT 'paper',
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      config JSON,
      source VARCHAR(20) NOT NULL DEFAULT 'custom',
      marketplace_item_id VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS trades (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      strategy_id VARCHAR(36),
      bot_id VARCHAR(36),
      symbol VARCHAR(20) NOT NULL,
      side ENUM('BUY','SELL') NOT NULL,
      quantity DECIMAL(15,6) NOT NULL,
      price DECIMAL(15,6) NOT NULL,
      entry_price DECIMAL(15,6) NOT NULL,
      exit_price DECIMAL(15,6) NULL,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      pnl DECIMAL(15,2) DEFAULT 0,
      opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS backtests (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      strategy_id VARCHAR(36),
      symbol VARCHAR(20) NOT NULL,
      timeframe VARCHAR(10) NOT NULL,
      start_date DATE,
      end_date DATE,
      result JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS optimizations (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      strategy_id VARCHAR(36),
      symbol VARCHAR(20) NOT NULL,
      timeframe VARCHAR(10) NOT NULL,
      param_space JSON NOT NULL,
      results JSON NOT NULL,
      walk_forward JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS price_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL,
      timeframe VARCHAR(10) NOT NULL,
      ts DATETIME NOT NULL,
      open DECIMAL(15,6) NOT NULL,
      high DECIMAL(15,6) NOT NULL,
      low DECIMAL(15,6) NOT NULL,
      close DECIMAL(15,6) NOT NULL,
      volume BIGINT NOT NULL DEFAULT 0,
      UNIQUE KEY uq_symbol_tf_ts (symbol, timeframe, ts)
    )`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      action VARCHAR(50) NOT NULL,
      detail JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS marketplace_items (
      id VARCHAR(36) PRIMARY KEY,
      creator_id VARCHAR(36),
      name VARCHAR(150) NOT NULL,
      description TEXT,
      symbol VARCHAR(20) NOT NULL,
      timeframe VARCHAR(10) NOT NULL DEFAULT '1h',
      rules JSON NOT NULL,
      risk JSON NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_free TINYINT(1) NOT NULL DEFAULT 1,
      rating DECIMAL(3,2) DEFAULT 0,
      rating_count INT NOT NULL DEFAULT 0,
      installs INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS marketplace_installs (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      item_id VARCHAR(36) NOT NULL,
      bot_id VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_item (user_id, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      type VARCHAR(20) NOT NULL,
      \`condition\` JSON NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      triggered_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS journal_notes (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      trade_id VARCHAR(36) NOT NULL,
      note TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS broker_connections (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      broker VARCHAR(30) NOT NULL,
      label VARCHAR(100),
      credentials_enc TEXT,
      permissions JSON,
      mode ENUM('paper','live') NOT NULL DEFAULT 'paper',
      live_enabled TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ];
  for (const sql of DDL) await pool.query(sql);

  const q = (sql, params = []) => pool.query(sql, params);

  const jsonCols = (row) => {
    if (!row) return null;
    const out = { ...row };
    for (const key of ['rules', 'risk', 'config', 'condition', 'param_space', 'results', 'walk_forward', 'preferred_markets', 'permissions', 'detail']) {
      if (out[key] != null && typeof out[key] === 'string') {
        try {
          out[key] = JSON.parse(out[key]);
        } catch {
          /* keep raw */
        }
      }
    }
    return out;
  };

  return {
    mode: 'mysql',

    // ---- users ----
    async findUserByEmail(email) {
      const [rows] = await q('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
      return rows[0] || null;
    },
    async findUserById(id) {
      const [rows] = await q('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
      return rows[0] || null;
    },
    async createUser({ name, email, passwordHash, balance = 10000 }) {
      const id = uuid();
      await q(
        'INSERT INTO users (id, name, email, password_hash, balance, peak_equity) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, email, passwordHash, balance, balance]
      );
      return this.findUserById(id);
    },
    async updateBalance(id, amount) {
      const user = await this.findUserById(id);
      if (!user) throw new Error('User not found');
      const balance = Number(user.balance) + Number(amount);
      const peak = Math.max(Number(user.peak_equity), balance);
      await q('UPDATE users SET balance = ?, peak_equity = ? WHERE id = ?', [balance, peak, id]);
      return balance;
    },
    async updatePassword(id, passwordHash) {
      await q('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    },
    async setBalance(id, balance) {
      const user = await this.findUserById(id);
      if (!user) throw new Error('User not found');
      const peak = Math.max(Number(user.peak_equity), Number(balance));
      await q('UPDATE users SET balance = ?, peak_equity = ? WHERE id = ?', [balance, peak, id]);
      return balance;
    },

    // ---- profiles ----
    async getProfile(userId) {
      const [rows] = await q('SELECT * FROM profiles WHERE user_id = ? LIMIT 1', [userId]);
      return jsonCols(rows[0]);
    },
    async upsertProfile(userId, fields) {
      const existing = await this.getProfile(userId);
      const next = { ...(existing || {}), ...fields, user_id: userId };
      if (existing) {
        await q(
          'UPDATE profiles SET experience = ?, risk_profile = ?, preferred_markets = ?, two_factor_secret = ?, two_factor_enabled = ? WHERE user_id = ?',
          [next.experience ?? null, next.risk_profile ?? null, next.preferred_markets ? JSON.stringify(next.preferred_markets) : null, next.two_factor_secret ?? null, next.two_factor_enabled ? 1 : 0, userId]
        );
      } else {
        await q(
          'INSERT INTO profiles (user_id, experience, risk_profile, preferred_markets, two_factor_secret, two_factor_enabled) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, next.experience ?? null, next.risk_profile ?? null, next.preferred_markets ? JSON.stringify(next.preferred_markets) : null, next.two_factor_secret ?? null, next.two_factor_enabled ? 1 : 0]
        );
      }
      return this.getProfile(userId);
    },

    // ---- refresh tokens ----
    async createRefreshToken({ userId, tokenHash, expiresAt }) {
      const id = uuid();
      await q('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)', [
        id, userId, tokenHash, toMysqlTs(expiresAt),
      ]);
      return id;
    },
    async findRefreshToken(tokenHash) {
      const [rows] = await q('SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1', [tokenHash]);
      return rows[0] || null;
    },
    async revokeRefreshToken(tokenHash) {
      await q('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [tokenHash]);
    },

    // ---- strategies ----
    async listStrategies(userId) {
      const [rows] = await q('SELECT * FROM strategies WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return rows.map(jsonCols);
    },
    async getStrategy(id) {
      const [rows] = await q('SELECT * FROM strategies WHERE id = ? LIMIT 1', [id]);
      return jsonCols(rows[0]);
    },
    async createStrategy({ user_id, name, symbol, timeframe, rules, risk }) {
      const id = uuid();
      await q(
        'INSERT INTO strategies (id, user_id, name, symbol, timeframe, rules, risk) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, user_id, name, symbol, timeframe, JSON.stringify(rules), JSON.stringify(risk)]
      );
      return this.getStrategy(id);
    },
    async updateStrategy(id, fields) {
      const s = await this.getStrategy(id);
      if (!s) return null;
      const sets = [];
      const params = [];
      for (const key of ['name', 'symbol', 'timeframe', 'rules', 'risk', 'active']) {
        if (fields[key] !== undefined) {
          sets.push(`${key} = ?`);
          params.push(typeof fields[key] === 'object' ? JSON.stringify(fields[key]) : fields[key]);
        }
      }
      if (sets.length) {
        params.push(id);
        await q(`UPDATE strategies SET ${sets.join(', ')} WHERE id = ?`, params);
      }
      return this.getStrategy(id);
    },
    async deleteStrategy(id) {
      await q('DELETE FROM strategies WHERE id = ?', [id]);
    },
    async activeStrategies() {
      const [rows] = await q('SELECT * FROM strategies WHERE active = 1');
      return rows.map(jsonCols);
    },

    // ---- bots ----
    async listBots(userId) {
      const [rows] = await q('SELECT * FROM bots WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return rows.map(jsonCols);
    },
    async getBot(id) {
      const [rows] = await q('SELECT * FROM bots WHERE id = ? LIMIT 1', [id]);
      return jsonCols(rows[0]);
    },
    async createBot({ user_id, strategy_id, name, mode = 'paper', status = 'DRAFT', config = {}, source = 'custom', marketplace_item_id = null }) {
      const id = uuid();
      await q(
        'INSERT INTO bots (id, user_id, strategy_id, name, mode, status, config, source, marketplace_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, user_id, strategy_id, name, mode, status, JSON.stringify(config), source, marketplace_item_id]
      );
      return this.getBot(id);
    },
    async updateBot(id, fields) {
      const b = await this.getBot(id);
      if (!b) return null;
      const sets = [];
      const params = [];
      for (const key of ['name', 'mode', 'status', 'config', 'source', 'marketplace_item_id']) {
        if (fields[key] !== undefined) {
          sets.push(`${key} = ?`);
          params.push(typeof fields[key] === 'object' ? JSON.stringify(fields[key]) : fields[key]);
        }
      }
      if (sets.length) {
        params.push(id);
        await q(`UPDATE bots SET ${sets.join(', ')} WHERE id = ?`, params);
      }
      return this.getBot(id);
    },
    async deleteBot(id) {
      await q('DELETE FROM bots WHERE id = ?', [id]);
    },
    async botForStrategy(userId, strategyId) {
      const [rows] = await q(
        'SELECT * FROM bots WHERE user_id = ? AND strategy_id = ? LIMIT 1',
        [userId, strategyId]
      );
      return jsonCols(rows[0]);
    },
    async runningBots() {
      const [rows] = await q('SELECT * FROM bots WHERE status = ?', ['RUNNING']);
      return rows.map(jsonCols);
    },

    // ---- trades ----
    async listTrades(userId) {
      const [rows] = await q('SELECT * FROM trades WHERE user_id = ? ORDER BY opened_at DESC', [userId]);
      return rows;
    },
    async openTrades(userId) {
      const [rows] = await q('SELECT * FROM trades WHERE user_id = ? AND status = "OPEN"', [userId]);
      return rows;
    },
    async createTrade(trade) {
      const id = uuid();
      await q(
        `INSERT INTO trades (id, user_id, strategy_id, bot_id, symbol, side, quantity, price, entry_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, trade.user_id, trade.strategy_id || null, trade.bot_id || null, trade.symbol, trade.side, trade.quantity, trade.price, trade.price]
      );
      const [rows] = await q('SELECT * FROM trades WHERE id = ?', [id]);
      return rows[0];
    },
    async closeTrade(id, { price, pnl }) {
      await q(
        'UPDATE trades SET status = "CLOSED", exit_price = ?, pnl = ?, closed_at = NOW() WHERE id = ?',
        [price, pnl, id]
      );
      const [rows] = await q('SELECT * FROM trades WHERE id = ?', [id]);
      return rows[0] || null;
    },

    // ---- backtests ----
    async createBacktest({ user_id, strategy_id, symbol, timeframe, result }) {
      const id = uuid();
      await q(
        'INSERT INTO backtests (id, user_id, strategy_id, symbol, timeframe, result) VALUES (?, ?, ?, ?, ?, ?)',
        [id, user_id, strategy_id, symbol, timeframe, JSON.stringify(result)]
      );
      const [rows] = await q('SELECT * FROM backtests WHERE id = ?', [id]);
      return rows[0];
    },
    async listBacktests(userId) {
      const [rows] = await q('SELECT * FROM backtests WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return rows;
    },
    async getBacktest(id) {
      const [rows] = await q('SELECT * FROM backtests WHERE id = ? LIMIT 1', [id]);
      return rows[0] || null;
    },

    // ---- optimizations ----
    async createOptimization({ user_id, strategy_id, symbol, timeframe, param_space, results, walk_forward }) {
      const id = uuid();
      await q(
        'INSERT INTO optimizations (id, user_id, strategy_id, symbol, timeframe, param_space, results, walk_forward) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, user_id, strategy_id || null, symbol, timeframe, JSON.stringify(param_space), JSON.stringify(results), walk_forward ? JSON.stringify(walk_forward) : null]
      );
      const [rows] = await q('SELECT * FROM optimizations WHERE id = ?', [id]);
      return rows[0];
    },
    async listOptimizations(userId) {
      const [rows] = await q('SELECT * FROM optimizations WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return rows.map(jsonCols);
    },

    // ---- market data ----
    async getCandles(symbol, timeframe, limit = 500) {
      const [rows] = await q(
        'SELECT * FROM price_history WHERE symbol = ? AND timeframe = ? ORDER BY ts DESC LIMIT ?',
        [symbol, timeframe, limit]
      );
      return rows.reverse();
    },
    async saveCandles(symbol, timeframe, rows) {
      if (!rows.length) return;
      const values = rows.map((r) => [symbol, timeframe, toMysqlTs(r.ts), r.open, r.high, r.low, r.close, r.volume]);
      await q(
        'INSERT IGNORE INTO price_history (symbol, timeframe, ts, open, high, low, close, volume) VALUES ?',
        [values]
      );
    },

    // ---- marketplace ----
    async listMarketplaceItems(limit = 50) {
      const [rows] = await q('SELECT * FROM marketplace_items ORDER BY installs DESC LIMIT ?', [limit]);
      return rows.map(jsonCols);
    },
    async getMarketplaceItem(id) {
      const [rows] = await q('SELECT * FROM marketplace_items WHERE id = ? LIMIT 1', [id]);
      return jsonCols(rows[0]);
    },
    async createMarketplaceItem({ creator_id, name, description, symbol, timeframe, rules, risk, price = 0, is_free = 1 }) {
      const id = uuid();
      await q(
        'INSERT INTO marketplace_items (id, creator_id, name, description, symbol, timeframe, rules, risk, price, is_free) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, creator_id || null, name, description || null, symbol, timeframe, JSON.stringify(rules), JSON.stringify(risk), price, is_free ? 1 : 0]
      );
      return this.getMarketplaceItem(id);
    },
    async recordInstall(userId, itemId, botId) {
      await q(
        'INSERT IGNORE INTO marketplace_installs (id, user_id, item_id, bot_id) VALUES (?, ?, ?, ?)',
        [uuid(), userId, itemId, botId]
      );
      await q('UPDATE marketplace_items SET installs = installs + 1 WHERE id = ?', [itemId]);
    },
    async hasInstalled(userId, itemId) {
      const [rows] = await q(
        'SELECT 1 AS x FROM marketplace_installs WHERE user_id = ? AND item_id = ? LIMIT 1',
        [userId, itemId]
      );
      return rows.length > 0;
    },

    // ---- alerts ----
    async listAlerts(userId) {
      const [rows] = await q('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return rows.map(jsonCols);
    },
    async createAlert({ user_id, symbol, type, condition }) {
      const id = uuid();
      await q('INSERT INTO alerts (id, user_id, symbol, type, `condition`) VALUES (?, ?, ?, ?, ?)', [
        id, user_id, symbol, type, JSON.stringify(condition),
      ]);
      const [rows] = await q('SELECT * FROM alerts WHERE id = ?', [id]);
      return jsonCols(rows[0]);
    },
    async updateAlert(id, fields) {
      const sets = [];
      const params = [];
      for (const key of ['active', 'triggered_at']) {
        if (fields[key] !== undefined) {
          sets.push(`${key} = ?`);
          params.push(typeof fields[key] === 'boolean' ? (fields[key] ? 1 : 0) : fields[key]);
        }
      }
      if (sets.length) {
        params.push(id);
        await q(`UPDATE alerts SET ${sets.join(', ')} WHERE id = ?`, params);
      }
      const [rows] = await q('SELECT * FROM alerts WHERE id = ?', [id]);
      return jsonCols(rows[0]);
    },
    async deleteAlert(id) {
      await q('DELETE FROM alerts WHERE id = ?', [id]);
    },

    // ---- journal ----
    async addJournalNote(userId, tradeId, note) {
      const id = uuid();
      await q('INSERT INTO journal_notes (id, user_id, trade_id, note) VALUES (?, ?, ?, ?)', [
        id, userId, tradeId, note,
      ]);
      const [rows] = await q('SELECT * FROM journal_notes WHERE id = ?', [id]);
      return rows[0];
    },
    async listJournalNotes(userId) {
      const [rows] = await q('SELECT * FROM journal_notes WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return rows;
    },

    // ---- broker connections ----
    async listBrokerConnections(userId) {
      const [rows] = await q('SELECT id, user_id, broker, label, permissions, mode, live_enabled, status, created_at, updated_at FROM broker_connections WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return rows.map(jsonCols);
    },
    async createBrokerConnection({ user_id, broker, label, credentials_enc, permissions, mode = 'paper' }) {
      const id = uuid();
      await q(
        'INSERT INTO broker_connections (id, user_id, broker, label, credentials_enc, permissions, mode, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, user_id, broker, label || null, credentials_enc || null, JSON.stringify(permissions || { read: true, trade: false, marketData: true }), mode, 'disconnected']
      );
      const [rows] = await q('SELECT * FROM broker_connections WHERE id = ?', [id]);
      return jsonCols(rows[0]);
    },
    async updateBrokerConnection(id, fields) {
      const sets = [];
      const params = [];
      for (const key of ['label', 'credentials_enc', 'permissions', 'mode', 'live_enabled', 'status']) {
        if (fields[key] !== undefined) {
          sets.push(`${key} = ?`);
          params.push(typeof fields[key] === 'object' ? JSON.stringify(fields[key]) : fields[key]);
        }
      }
      if (sets.length) {
        params.push(id);
        await q(`UPDATE broker_connections SET ${sets.join(', ')} WHERE id = ?`, params);
      }
      const [rows] = await q('SELECT * FROM broker_connections WHERE id = ?', [id]);
      return jsonCols(rows[0]);
    },
    async getBrokerConnection(id) {
      const [rows] = await q('SELECT * FROM broker_connections WHERE id = ? LIMIT 1', [id]);
      return jsonCols(rows[0]);
    },
    async deleteBrokerConnection(id) {
      await q('DELETE FROM broker_connections WHERE id = ?', [id]);
    },

    // ---- logs ----
    async addLog(userId, action, detail = {}) {
      await q('INSERT INTO activity_logs (user_id, action, detail) VALUES (?, ?, ?)', [
        userId, action, JSON.stringify(detail),
      ]);
    },
    async listLogs(userId) {
      const [rows] = await q(
        'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY id DESC LIMIT 200',
        [userId]
      );
      return rows;
    },
  };
}

module.exports = { createMysqlStore };