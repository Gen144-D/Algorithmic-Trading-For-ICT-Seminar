const { createMysqlStore } = require('../data/mysql');
const { createMemoryStore } = require('../data/memory');

let store = null;

async function getStore() {
  if (store) return store;

  if (process.env.DISABLE_MYSQL !== '1') {
    try {
      store = await createMysqlStore();
      console.log('[db] Connected to MySQL');
      return store;
    } catch (err) {
      console.warn(`[db] MySQL unavailable (${err.message}) — using in-memory store`);
    }
  }

  store = createMemoryStore();
  return store;
}

module.exports = { getStore };
