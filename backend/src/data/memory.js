const { v4: uuid } = require('uuid');

function createMemoryStore() {
  const users = new Map();
  const strategies = new Map();
  const trades = new Map();
  const backtests = new Map();
  const candles = new Map();
  const logs = [];

  const candleKey = (symbol, timeframe, ts) => `${symbol}|${timeframe}|${ts}`;

  return {
    mode: 'memory',

    // ---- users ----
    async findUserByEmail(email) {
      for (const u of users.values()) if (u.email === email) return { ...u };
      return null;
    },
    async findUserById(id) {
      return users.has(id) ? { ...users.get(id) } : null;
    },
    async createUser({ name, email, passwordHash, balance = 10000 }) {
      const id = uuid();
      const user = {
        id, name, email, password_hash: passwordHash,
        balance, created_at: new Date().toISOString(),
      };
      users.set(id, user);
      return { ...user };
    },
    async updateBalance(id, amount) {
      const u = users.get(id);
      if (!u) throw new Error('User not found');
      u.balance = Math.round(u.balance * 100 + amount * 100) / 100;
      return u.balance;
    },
    async setBalance(id, balance) {
      const u = users.get(id);
      if (!u) throw new Error('User not found');
      u.balance = balance;
      return u.balance;
    },

    // ---- strategies ----
    async listStrategies(userId) {
      return [...strategies.values()].filter((s) => s.user_id === userId);
    },
    async getStrategy(id) {
      return strategies.has(id) ? { ...strategies.get(id) } : null;
    },
    async createStrategy({ user_id, name, symbol, timeframe, rules, risk }) {
      const id = uuid();
      const s = {
        id, user_id, name, symbol, timeframe,
        rules, risk, active: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      strategies.set(id, s);
      return { ...s };
    },
    async updateStrategy(id, fields) {
      const s = strategies.get(id);
      if (!s) return null;
      const next = { ...s, ...fields, updated_at: new Date().toISOString() };
      strategies.set(id, next);
      return { ...next };
    },
    async deleteStrategy(id) {
      return strategies.delete(id);
    },
    async activeStrategies() {
      return [...strategies.values()].filter((s) => s.active === 1);
    },

    // ---- trades ----
    async listTrades(userId) {
      return [...trades.values()].filter((t) => t.user_id === userId);
    },
    async openTrades(userId) {
      return [...trades.values()].filter((t) => t.user_id === userId && t.status === 'OPEN');
    },
    async createTrade(trade) {
      const id = uuid();
      const t = {
        id, status: 'OPEN', pnl: 0, opened_at: new Date().toISOString(), closed_at: null,
        ...trade,
      };
      trades.set(id, t);
      return { ...t };
    },
    async closeTrade(id, { price, pnl }) {
      const t = trades.get(id);
      if (!t) return null;
      const next = {
        ...t, status: 'CLOSED', price, pnl,
        closed_at: new Date().toISOString(),
      };
      trades.set(id, next);
      return { ...next };
    },

    // ---- backtests ----
    async createBacktest({ user_id, strategy_id, symbol, timeframe, result }) {
      const id = uuid();
      const b = {
        id, user_id, strategy_id, symbol, timeframe,
        result, created_at: new Date().toISOString(),
      };
      backtests.set(id, b);
      return { ...b };
    },
    async listBacktests(userId) {
      return [...backtests.values()].filter((b) => b.user_id === userId);
    },
    async getBacktest(id) {
      return backtests.has(id) ? { ...backtests.get(id) } : null;
    },

    // ---- candles ----
    async getCandles(symbol, timeframe, limit = 500) {
      const prefix = `${symbol}|${timeframe}|`;
      const keys = [...candles.keys()].filter((k) => k.startsWith(prefix)).sort();
      const out = keys.slice(-limit).map((k) => candles.get(k));
      return out;
    },
    async saveCandles(symbol, timeframe, rows) {
      for (const r of rows) {
        candles.set(candleKey(symbol, timeframe, r.ts), { symbol, timeframe, ...r });
      }
    },

    // ---- logs ----
    async addLog(userId, action, detail = {}) {
      logs.push({
        id: uuid(), user_id: userId, action, detail,
        created_at: new Date().toISOString(),
      });
    },
    async listLogs(userId) {
      return logs.filter((l) => l.user_id === userId).slice(-200).reverse();
    },
  };
}

module.exports = { createMemoryStore };
