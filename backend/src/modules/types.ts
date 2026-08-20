// Shared domain types for the trading platform (TypeScript modules).

export interface Candle {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol?: string;
  timeframe?: string;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  ts: string;
}

export type OrderSide = 'BUY' | 'SELL';

export type TradeStatus = 'OPEN' | 'CLOSED';

export type BotStatus =
  | 'DRAFT'
  | 'BACKTESTING'
  | 'PAPER'
  | 'LIVE'
  | 'RUNNING'
  | 'PAUSED'
  | 'ERROR'
  | 'STOPPED';

export type BotMode = 'paper' | 'live';

export interface RiskConfig {
  stopLossPct?: number;
  takeProfitPct?: number;
  trailingStopPct?: number;
  positionSize?: number;
  riskPerTradePct?: number;
  maxOpenTrades?: number;
  maxDailyLossPct?: number;
  maxDrawdownPct?: number;
  maxExposurePct?: number;
  maxOrderNotional?: number;
  tradingSessions?: string[];
}

export type ConditionType =
  | 'crossover'
  | 'crossunder'
  | 'above'
  | 'below'
  | 'cross_above'
  | 'cross_below'
  | 'band_above'
  | 'band_below'
  | 'histogram_above'
  | 'histogram_below'
  | 'always';

export interface Condition {
  type: ConditionType;
  indicator?: string;
  value?: number;
  fast?: string;
  slow?: string;
  [key: string]: unknown;
}

export interface StrategyRule {
  indicators?: Record<string, number>;
  buyConditions: Condition[];
  sellConditions: Condition[];
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  symbol: string;
  timeframe: string;
  rules: StrategyRule;
  risk: RiskConfig;
  active: number;
  mode?: BotMode;
  created_at?: string;
  updated_at?: string;
}

export interface Trade {
  id: string;
  user_id: string;
  strategy_id?: string | null;
  bot_id?: string | null;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  entry_price: number;
  exit_price: number | null;
  status: TradeStatus;
  pnl: number;
  opened_at: string;
  closed_at: string | null;
}

export interface Position {
  id: string;
  user_id: string;
  strategy_id?: string | null;
  bot_id?: string | null;
  symbol: string;
  side: OrderSide;
  quantity: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  opened_at: string;
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
  numTrades: number;
  winRate: number;
  profitFactor: number;
  avgWinPct: number;
  avgLossPct: number;
  maxDrawdown: number;
  sharpe: number;
  sortino: number;
  avgTrade: number;
  largestWin: number;
  largestLoss: number;
  expectancy: number;
  feesPaid: number;
  slippagePaid: number;
  trades: BacktestTrade[];
  equityCurve: { i: number; ts: string; equity: number }[];
}

export interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  reason: string;
}

export interface BacktestOptions {
  initialCapital?: number;
  feePct?: number;
  slippagePct?: number;
  allowShort?: boolean;
}
