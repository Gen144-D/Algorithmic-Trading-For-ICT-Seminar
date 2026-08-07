const { getStore } = require('../config/db');
const { getCandles, getQuote } = require('./market');
const { checkSignal } = require('./engine');

// The automated trading loop. Runs periodically:
//   1. fetch market data for each active strategy
//   2. evaluate strategy rules -> BUY / SELL / WAIT
//   3. enforce risk management (stop loss / take profit / max open trades)
//   4. execute orders against the (paper) account and broadcast results
async function runEngine(broadcast) {
  const store = await getStore();
  const active = await store.activeStrategies();
  if (active.length === 0) return;

  for (const strategy of active) {
    try {
      const candles = await getCandles(strategy.symbol, strategy.timeframe, 200, { live: true });
      const latest = candles[candles.length - 1];
      const risk = strategy.risk || {};
      const { signal } = checkSignal(candles, strategy);
      const open = (await store.openTrades(strategy.user_id))
        .filter((t) => t.strategy_id === strategy.id);

      if (signal !== 'WAIT') {
        console.log(`[engine] ${new Date().toISOString()} ${strategy.symbol} -> ${signal} (open: ${open.length})`);
      }

      if (signal === 'BUY' && open.length < (risk.maxOpenTrades || 3)) {
        const user = await store.findUserById(strategy.user_id);
        const qty = (risk.positionSize || 1000) / latest.close;
        const cost = qty * latest.close;
        if (user.balance >= cost) {
          await store.updateBalance(strategy.user_id, -cost);
          await store.createTrade({
            user_id: strategy.user_id, strategy_id: strategy.id,
            symbol: strategy.symbol, side: 'BUY', quantity: qty, price: latest.close,
          });
          await store.addLog(strategy.user_id, 'SIGNAL_BUY', {
            symbol: strategy.symbol, price: latest.close, strategy: strategy.name,
          });
          broadcast({ type: 'SIGNAL', signal: 'BUY', symbol: strategy.symbol, price: latest.close, strategy: strategy.name });
        }
      } else if (signal === 'SELL' && open.length) {
        const pos = open[0];
        const proceeds = pos.quantity * latest.close;
        const pnl = proceeds - pos.quantity * pos.price;
        await store.updateBalance(strategy.user_id, proceeds);
        await store.closeTrade(pos.id, { price: latest.close, pnl });
        await store.addLog(strategy.user_id, 'SIGNAL_SELL', {
          symbol: strategy.symbol, price: latest.close, pnl, strategy: strategy.name,
        });
        broadcast({ type: 'SIGNAL', signal: 'SELL', symbol: strategy.symbol, price: latest.close, pnl, strategy: strategy.name });
      }

      // risk management: stop loss / take profit on open positions
      for (const pos of open) {
        const slPrice = pos.price * (1 - (risk.stopLossPct || 0) / 100);
        const tpPrice = pos.price * (1 + (risk.takeProfitPct || 0) / 100);
        const exit = latest.low <= slPrice ? slPrice : latest.high >= tpPrice ? tpPrice : null;
        if (exit) {
          const pnl = (exit - pos.price) * pos.quantity;
          await store.updateBalance(strategy.user_id, pos.quantity * exit);
          await store.closeTrade(pos.id, { price: exit, pnl });
          await store.addLog(strategy.user_id, exit <= slPrice ? 'STOP_LOSS' : 'TAKE_PROFIT', {
            symbol: strategy.symbol, price: exit, pnl, strategy: strategy.name,
          });
          broadcast({ type: 'SIGNAL', signal: 'EXIT', reason: exit <= slPrice ? 'STOP_LOSS' : 'TAKE_PROFIT', symbol: strategy.symbol, price: exit, pnl, strategy: strategy.name });
        }
      }
    } catch (err) {
      console.error(`[engine] error for strategy ${strategy.id}: ${err.message}`);
    }
  }
}

module.exports = { runEngine };
