const { createMysqlStore } = require('../data/mysql');
const { createMemoryStore } = require('../data/memory');
const { createSqliteStore } = require('../data/sqlite');

let store = null;

async function getStore() {
  if (store) return store;

  if (process.env.DISABLE_MYSQL !== '1') {
    try {
      store = await createMysqlStore();
      console.log('[db] Connected to MySQL');
      return store;
    } catch (err) {
      console.warn(`[db] MySQL unavailable (${err.message}) — falling back to SQLite`);
    }
  }

  try {
    store = createSqliteStore();
    console.log(`[db] Using SQLite store (${process.env.SQLITE_PATH || 'backend/data/trading.db'})`);
    return store;
  } catch (err) {
    console.warn(`[db] SQLite unavailable (${err.message}) — using in-memory store`);
  }

  store = createMemoryStore();
  return store;
}

module.exports = { getStore };