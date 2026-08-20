// Typed view over the JS store layer (mysql.js / memory.js).
// Kept loose — the store implements far more; this is the surface the TS
// trading modules actually rely on.

import type { Candle, Strategy, Trade } from './types';

export interface Bot {
  id: string;
  user_id: string;
  strategy_id: string;
  name: string;
  mode: 'paper' | 'live';
  status: string;
  config: Record<string, unknown>;
  source: string;
  marketplace_item_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Store {
  mode: string;
  findUserById(id: string): Promise<{ id: string; name?: string; email?: string; balance: number; peak_equity?: number } | null>;
  updateBalance(id: string, amount: number): Promise<number>;
  setBalance(id: string, balance: number): Promise<number>;

  getProfile(userId: string): Promise<Record<string, unknown> | null>;
  upsertProfile(userId: string, fields: Record<string, unknown>): Promise<Record<string, unknown>>;

  listStrategies(userId: string): Promise<Strategy[]>;
  getStrategy(id: string): Promise<Strategy | null>;
  createStrategy(args: Record<string, unknown>): Promise<Strategy>;
  updateStrategy(id: string, fields: Record<string, unknown>): Promise<Strategy | null>;
  deleteStrategy(id: string): Promise<unknown>;
  activeStrategies(): Promise<Strategy[]>;

  listBots(userId: string): Promise<Bot[]>;
  getBot(id: string): Promise<Bot | null>;
  createBot(args: Record<string, unknown>): Promise<Bot>;
  updateBot(id: string, fields: Record<string, unknown>): Promise<Bot | null>;
  deleteBot(id: string): Promise<unknown>;
  runningBots(): Promise<Bot[]>;
  botForStrategy(userId: string, strategyId: string): Promise<Bot | null>;

  listTrades(userId: string): Promise<Trade[]>;
  openTrades(userId: string): Promise<Trade[]>;
  createTrade(args: Record<string, unknown>): Promise<Trade>;
  closeTrade(id: string, args: { price: number; pnl: number }): Promise<Trade | null>;

  createBacktest(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  listBacktests(userId: string): Promise<Record<string, unknown>[]>;
  getBacktest(id: string): Promise<Record<string, unknown> | null>;

  createOptimization(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  listOptimizations(userId: string): Promise<Record<string, unknown>[]>;

  getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]>;
  saveCandles(symbol: string, timeframe: string, rows: Candle[]): Promise<unknown>;

  listMarketplaceItems(limit?: number): Promise<Record<string, unknown>[]>;
  getMarketplaceItem(id: string): Promise<Record<string, unknown> | null>;
  createMarketplaceItem(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  recordInstall(userId: string, itemId: string, botId?: string | null): Promise<unknown>;
  hasInstalled(userId: string, itemId: string): Promise<boolean>;

  listAlerts(userId: string): Promise<Record<string, unknown>[]>;
  createAlert(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateAlert(id: string, fields: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  deleteAlert(id: string): Promise<unknown>;

  addJournalNote(userId: string, tradeId: string, note: string): Promise<Record<string, unknown>>;
  listJournalNotes(userId: string): Promise<Record<string, unknown>[]>;

  listBrokerConnections(userId: string): Promise<Record<string, unknown>[]>;
  createBrokerConnection(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateBrokerConnection(id: string, fields: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  getBrokerConnection(id: string): Promise<Record<string, unknown> | null>;
  deleteBrokerConnection(id: string): Promise<unknown>;

  addLog(userId: string, action: string, detail?: Record<string, unknown>): Promise<unknown>;
  listLogs(userId: string): Promise<Record<string, unknown>[]>;
}
