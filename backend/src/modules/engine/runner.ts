// Trading runner — the automated execution loop.
// Iterates running bots, evaluates strategy rules, gates every order through
// the risk engine, executes via the paper account, and publishes events on the
// bus so the API server can fan them out to the right user's WebSocket.
//
// Runs either in-process (dev fallback) or as the standalone `engine` worker.

import { getStore } from '../../config/db';
import { checkSignal } from '../engine';
import { riskEngine } from '../risk';
import { createMarketService, type MarketService } from '../market/service';
import { Channels, getBus } from '../bus';
import type { Store } from '../store';
import type { Trade } from '../types';

export interface EngineEvent {
  type: string;
  userId: string;
  payload: Record<string, unknown>;
}

let storePromise: Promise<Store> | null = null;
let marketPromise: Promise<MarketService> | null = null;

async function store(): Promise<Store> {
  if (!storePromise) storePromise = getStore() as Promise<Store>;
  return storePromise;
}

async function market(): Promise<MarketService> {
  if (!marketPromise) {
    const s = await store();
    marketPromise = Promise.resolve(createMarketService({ store: s }));
  }
  return marketPromise;
}

async function publishEvent(event: EngineEvent): Promise<void> {
  const bus = getBus();
  await bus.publish(Channels.ENGINE_EVENTS, event);
}

/** Realized P/L since local midnight for daily-loss protection. */
function todayRealizedPnL(trades: Trade[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return trades
    .filter((t) => t.status === 'CLOSED' && t.closed_at && new Date(t.closed_at) >= start)
    .reduce((a, t) => a + Number(t.pnl || 0), 0);
}

export async function tick(now = new Date()): Promise<void> {
  const s = await store();
  const m = await market();
  const bots = await s.runningBots();
  if (!bots.length) return;

  for (const bot of bots) {
    try {
      await runBot(bot.id, s, m, now);
    } catch (err) {
      console.error(`[engine] bot ${bot.id} failed:`, (err as Error).message);
      await s.updateBot(bot.id, { status: 'ERROR' }).catch(() => {});
      await publishEvent({
        type: 'BOT_ERROR',
        userId: bot.user_id,
        payload: { botId: bot.id, error: (err as Error).message },
      });
    }
  }
}

async function runBot(botId: string, s: Store, m: MarketService, now: Date): Promise<void> {
  const bot = await s.getBot(botId);
  if (!bot || bot.status !== 'RUNNING') return;
  const strategy = await s.getStrategy(bot.strategy_id);
  if (!strategy) return;

  const risk = strategy.risk || {};
  const candles = await m.getCandles(strategy.symbol, strategy.timeframe, 200, { live: true });
  const latest = candles[candles.length - 1];
  if (!latest) return;

  const { signal } = checkSignal(candles, strategy);
  const allOpen = await s.openTrades(bot.user_id);
  const open = allOpen.filter((t) => t.bot_id === botId || t.strategy_id === bot.strategy_id);
  const closed = new Set<string>();

  if (signal !== 'WAIT') {
    console.log(`[engine] ${now.toISOString()} ${strategy.symbol} -> ${signal} (bot ${bot.name})`);
  }

  const close = async (pos: Trade, price: number, reason: string) => {
    const pnl = (price - pos.entry_price) * pos.quantity;
    const proceeds = pos.quantity * price;
    await s.updateBalance(bot.user_id, proceeds);
    await s.closeTrade(pos.id, { price, pnl });
    closed.add(pos.id);
    await s.addLog(bot.user_id, reason, {
      symbol: strategy.symbol, price, pnl, bot: bot.name, strategy: strategy.name,
    });
    await publishEvent({
      type: 'SIGNAL',
      userId: bot.user_id,
      payload: { signal: 'EXIT', reason, symbol: strategy.symbol, price, pnl, bot: bot.name, strategy: strategy.name },
    });
  };

  // 1. Exit management: stop loss / take profit / trailing stop on open positions
  for (const pos of open) {
    if (closed.has(pos.id)) continue;
    const slPct = (risk.stopLossPct || 0) / 100;
    const tpPct = (risk.takeProfitPct || 0) / 100;
    const trailPct = (risk.trailingStopPct || 0) / 100;
    const slPrice = pos.entry_price * (1 - slPct);
    const tpPrice = pos.entry_price * (1 + tpPct);
    const bestHigh = Math.max(...candles.map((c) => c.high));
    const trailStop = trailPct > 0 ? bestHigh * (1 - trailPct) : 0;
    const exit = latest.low <= slPrice ? { price: slPrice, reason: 'STOP_LOSS' }
      : latest.high >= tpPrice ? { price: tpPrice, reason: 'TAKE_PROFIT' }
      : trailPct > 0 && latest.low <= trailStop ? { price: trailStop, reason: 'TRAILING_STOP' }
      : null;
    if (exit) await close(pos, exit.price, exit.reason);
  }

  // 2. Entry management
  const remainingOpen = (await s.openTrades(bot.user_id)).filter((t) => t.bot_id === botId || t.strategy_id === bot.strategy_id);
  if (signal === 'BUY' && remainingOpen.length < (risk.maxOpenTrades || 3)) {
    const user = await s.findUserById(bot.user_id);
    if (!user) return;
    const todayPnl = todayRealizedPnL(await s.listTrades(bot.user_id));
    const decision = riskEngine.evaluate({
      userId: bot.user_id,
      balance: user.balance,
      equity: user.balance,
      drawdownPct: (user.peak_equity || 0) > 0 ? Math.max(0, ((user.peak_equity || 0) - user.balance) / (user.peak_equity || 0) * 100) : 0,
      symbol: strategy.symbol,
      side: 'BUY',
      price: latest.close,
      risk,
      openTrades: remainingOpen,
      todayRealizedPnL: todayPnl,
    });

    if (decision.allowed) {
      const qty = decision.quantity;
      const cost = qty * latest.close;
      await s.updateBalance(bot.user_id, -cost);
      await s.createTrade({
        user_id: bot.user_id, strategy_id: bot.strategy_id, bot_id: bot.id,
        symbol: strategy.symbol, side: 'BUY', quantity: qty, price: latest.close,
      });
      await s.addLog(bot.user_id, 'SIGNAL_BUY', {
        symbol: strategy.symbol, price: latest.close, bot: bot.name, strategy: strategy.name,
      });
      await publishEvent({
        type: 'SIGNAL',
        userId: bot.user_id,
        payload: { signal: 'BUY', symbol: strategy.symbol, price: latest.close, bot: bot.name, strategy: strategy.name },
      });
    } else {
      console.log(`[engine] blocked ${strategy.symbol} BUY: ${decision.reasons.join('; ')}`);
    }
  } else if (signal === 'SELL' && remainingOpen.length) {
    const pos = remainingOpen[0];
    await close(pos, latest.close, 'SIGNAL');
  }
}

export async function runForever(intervalMs: number): Promise<void> {
  const bus = getBus();
  const run = async () => {
    try {
      await tick(new Date());
    } catch (err) {
      console.error('[engine] tick failed:', (err as Error).message);
    }
  };
  await run();
  setInterval(run, intervalMs);
  console.log(`[engine] worker started (every ${intervalMs}ms, bus=${bus.usingRedis ? 'redis' : 'memory'})`);
}
