const { v4: uuid } = require('uuid');

function createMemoryStore() {
  const users = new Map();
  const profiles = new Map();
  const refreshTokens = new Map();
  const strategies = new Map();
  const bots = new Map();
  const trades = new Map();
  const backtests = new Map();
  const optimizations = new Map();
  const candles = new Map();
  const marketplaceItems = new Map();
  const marketplaceInstalls = new Map();
  const alerts = new Map();
  const journalNotes = new Map();
  const brokerConnections = new Map();
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
        balance, peak_equity: balance, created_at: new Date().toISOString(),
      };
      users.set(id, user);
      return { ...user };
    },
    async updateBalance(id, amount) {
      const u = users.get(id);
      if (!u) throw new Error('User not found');
      u.balance = Math.round(u.balance * 100 + amount * 100) / 100;
      u.peak_equity = Math.max(u.peak_equity, u.balance);
      return u.balance;
    },
    async updatePassword(id, passwordHash) {
      const u = users.get(id);
      if (u) u.password_hash = passwordHash;
    },
    async setBalance(id, balance) {
      const u = users.get(id);
      if (!u) throw new Error('User not found');
      u.balance = balance;
      u.peak_equity = Math.max(u.peak_equity, balance);
      return u.balance;
    },

    // ---- profiles ----
    async getProfile(userId) {
      return profiles.has(userId) ? { ...profiles.get(userId) } : null;
    },
    async upsertProfile(userId, fields) {
      const next = { user_id: userId, ...(profiles.get(userId) || {}), ...fields, user_id: userId };
      profiles.set(userId, next);
      return { ...next };
    },

    // ---- refresh tokens ----
    async createRefreshToken({ userId, tokenHash, expiresAt }) {
      const id = uuid();
      refreshTokens.set(tokenHash, { id, user_id: userId, token_hash: tokenHash, expires_at: new Date(expiresAt).toISOString(), revoked: 0, created_at: new Date().toISOString() });
      return id;
    },
    async findRefreshToken(tokenHash) {
      return refreshTokens.has(tokenHash) ? { ...refreshTokens.get(tokenHash) } : null;
    },
    async revokeRefreshToken(tokenHash) {
      const t = refreshTokens.get(tokenHash);
      if (t) t.revoked = 1;
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

    // ---- bots ----
    async listBots(userId) {
      return [...bots.values()].filter((b) => b.user_id === userId);
    },
    async getBot(id) {
      return bots.has(id) ? { ...bots.get(id) } : null;
    },
    async createBot({ user_id, strategy_id, name, mode = 'paper', status = 'DRAFT', config = {}, source = 'custom', marketplace_item_id = null }) {
      const id = uuid();
      const b = {
        id, user_id, strategy_id, name, mode, status, config, source, marketplace_item_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      bots.set(id, b);
      return { ...b };
    },
    async updateBot(id, fields) {
      const b = bots.get(id);
      if (!b) return null;
      const next = { ...b, ...fields, updated_at: new Date().toISOString() };
      bots.set(id, next);
      return { ...next };
    },
    async deleteBot(id) {
      return bots.delete(id);
    },
    async botForStrategy(userId, strategyId) {
      for (const b of bots.values()) {
        if (b.user_id === userId && b.strategy_id === strategyId) return { ...b };
      }
      return null;
    },
    async runningBots() {
      return [...bots.values()].filter((b) => b.status === 'RUNNING');
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
        entry_price: trade.price, exit_price: null, bot_id: trade.bot_id || null,
        ...trade,
      };
      trades.set(id, t);
      return { ...t };
    },
    async closeTrade(id, { price, pnl }) {
      const t = trades.get(id);
      if (!t) return null;
      const next = {
        ...t, status: 'CLOSED', exit_price: price, pnl,
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

    // ---- optimizations ----
    async createOptimization({ user_id, strategy_id, symbol, timeframe, param_space, results, walk_forward }) {
      const id = uuid();
      const o = {
        id, user_id, strategy_id, symbol, timeframe, param_space, results, walk_forward,
        created_at: new Date().toISOString(),
      };
      optimizations.set(id, o);
      return { ...o };
    },
    async listOptimizations(userId) {
      return [...optimizations.values()].filter((o) => o.user_id === userId);
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

    // ---- marketplace ----
    async listMarketplaceItems(limit = 50) {
      return [...marketplaceItems.values()].sort((a, b) => b.installs - a.installs).slice(0, limit);
    },
    async getMarketplaceItem(id) {
      return marketplaceItems.has(id) ? { ...marketplaceItems.get(id) } : null;
    },
    async createMarketplaceItem({ creator_id, name, description, symbol, timeframe, rules, risk, price = 0, is_free = 1 }) {
      const id = uuid();
      const item = {
        id, creator_id, name, description, symbol, timeframe, rules, risk,
        price, is_free: is_free ? 1 : 0, rating: 0, rating_count: 0, installs: 0,
        created_at: new Date().toISOString(),
      };
      marketplaceItems.set(id, item);
      return { ...item };
    },
    async recordInstall(userId, itemId, botId) {
      const key = `${userId}|${itemId}`;
      if (marketplaceInstalls.has(key)) return;
      marketplaceInstalls.set(key, { user_id: userId, item_id: itemId, bot_id: botId });
      const item = marketplaceItems.get(itemId);
      if (item) item.installs = (item.installs || 0) + 1;
    },
    async hasInstalled(userId, itemId) {
      return marketplaceInstalls.has(`${userId}|${itemId}`);
    },

    // ---- alerts ----
    async listAlerts(userId) {
      return [...alerts.values()].filter((a) => a.user_id === userId);
    },
    async createAlert({ user_id, symbol, type, condition }) {
      const id = uuid();
      const a = {
        id, user_id, symbol, type, condition, active: 1,
        triggered_at: null, created_at: new Date().toISOString(),
      };
      alerts.set(id, a);
      return { ...a };
    },
    async updateAlert(id, fields) {
      const a = alerts.get(id);
      if (!a) return null;
      const next = { ...a, ...fields };
      alerts.set(id, next);
      return { ...next };
    },
    async deleteAlert(id) {
      return alerts.delete(id);
    },

    // ---- journal ----
    async addJournalNote(userId, tradeId, note) {
      const id = uuid();
      const n = { id, user_id: userId, trade_id: tradeId, note, created_at: new Date().toISOString() };
      journalNotes.set(id, n);
      return { ...n };
    },
    async listJournalNotes(userId) {
      return [...journalNotes.values()].filter((n) => n.user_id === userId);
    },

    // ---- broker connections ----
    async listBrokerConnections(userId) {
      return [...brokerConnections.values()].filter((c) => c.user_id === userId);
    },
    async createBrokerConnection({ user_id, broker, label, credentials_enc, permissions, mode = 'paper' }) {
      const id = uuid();
      const c = {
        id, user_id, broker, label, credentials_enc, permissions,
        mode, live_enabled: 0, status: 'disconnected',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      brokerConnections.set(id, c);
      return { ...c };
    },
    async updateBrokerConnection(id, fields) {
      const c = brokerConnections.get(id);
      if (!c) return null;
      const next = { ...c, ...fields, updated_at: new Date().toISOString() };
      brokerConnections.set(id, next);
      return { ...next };
    },
    async getBrokerConnection(id) {
      return brokerConnections.has(id) ? { ...brokerConnections.get(id) } : null;
    },
    async deleteBrokerConnection(id) {
      return brokerConnections.delete(id);
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