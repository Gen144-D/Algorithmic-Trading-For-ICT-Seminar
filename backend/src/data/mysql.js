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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    `CREATE TABLE IF NOT EXISTS trades (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      strategy_id VARCHAR(36),
      symbol VARCHAR(20) NOT NULL,
      side ENUM('BUY','SELL') NOT NULL,
      quantity DECIMAL(15,6) NOT NULL,
      price DECIMAL(15,6) NOT NULL,
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
  ];
  for (const sql of DDL) await pool.query(sql);

  const q = (sql, params = []) => pool.query(sql, params);

  return {
    mode: 'mysql',

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
        'INSERT INTO users (id, name, email, password_hash, balance) VALUES (?, ?, ?, ?, ?)',
        [id, name, email, passwordHash, balance]
      );
      return this.findUserById(id);
    },
    async updateBalance(id, amount) {
      const user = await this.findUserById(id);
      if (!user) throw new Error('User not found');
      const balance = Number(user.balance) + Number(amount);
      await q('UPDATE users SET balance = ? WHERE id = ?', [balance, id]);
      return balance;
    },
    async setBalance(id, balance) {
      await q('UPDATE users SET balance = ? WHERE id = ?', [balance, id]);
      return balance;
    },

    async listStrategies(userId) {
      const [rows] = await q('SELECT * FROM strategies WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return rows;
    },
    async getStrategy(id) {
      const [rows] = await q('SELECT * FROM strategies WHERE id = ? LIMIT 1', [id]);
      return rows[0] || null;
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
      return rows;
    },

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
        `INSERT INTO trades (id, user_id, strategy_id, symbol, side, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, trade.user_id, trade.strategy_id || null, trade.symbol, trade.side, trade.quantity, trade.price]
      );
      const [rows] = await q('SELECT * FROM trades WHERE id = ?', [id]);
      return rows[0];
    },
    async closeTrade(id, { price, pnl }) {
      await q(
        'UPDATE trades SET status = "CLOSED", price = ?, pnl = ?, closed_at = NOW() WHERE id = ?',
        [price, pnl, id]
      );
      const [rows] = await q('SELECT * FROM trades WHERE id = ?', [id]);
      return rows[0] || null;
    },

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
