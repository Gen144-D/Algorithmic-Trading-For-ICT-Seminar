import { describe, it, expect } from 'vitest';
import { RiskEngine, sizePosition } from '../src/modules/risk';
import type { RiskConfig, Trade } from '../src/modules/types';

const open = (symbol: string, side: 'BUY' | 'SELL', qty: number, price: number): Trade => ({
  id: 't', user_id: 'u', symbol, side, quantity: qty, price,
  entry_price: price, exit_price: null, status: 'OPEN', pnl: 0,
  opened_at: new Date().toISOString(), closed_at: null,
});

const baseRisk: RiskConfig = { stopLossPct: 2, positionSize: 1000, maxOpenTrades: 3 };

function ctx(over: Partial<Parameters<RiskEngine['evaluate']>[0]> = {}) {
  return {
    userId: 'u',
    balance: 10000,
    equity: 10000,
    drawdownPct: 0,
    symbol: 'BTC',
    side: 'BUY' as const,
    price: 100,
    risk: baseRisk,
    openTrades: [],
    todayRealizedPnL: 0,
    ...over,
  };
}

describe('sizePosition', () => {
  it('uses fixed positionSize when no risk per trade', () => {
    expect(sizePosition(baseRisk, 10000, 100)).toEqual({ notional: 1000, riskAmount: 20 });
  });
  it('derives notional from risk per trade and stop loss', () => {
    const r = { riskPerTradePct: 1, stopLossPct: 2 };
    const out = sizePosition(r as RiskConfig, 10000, 100);
    expect(out.riskAmount).toBeCloseTo(100); // 1% of 10000
    expect(out.notional).toBeCloseTo(5000); // 100 / 0.02
  });
});

describe('RiskEngine.evaluate', () => {
  it('passes a clean order and sizes quantity', () => {
    const d = new RiskEngine().evaluate(ctx());
    expect(d.allowed).toBe(true);
    expect(d.quantity).toBeCloseTo(10);
  });

  it('rejects when max open trades reached', () => {
    const openTrades = [open('ETH', 'BUY', 1, 2000), open('SOL', 'BUY', 1, 100), open('XRP', 'BUY', 1, 50)];
    const d = new RiskEngine().evaluate(ctx({ openTrades }));
    expect(d.allowed).toBe(false);
    expect(d.reasons.join()).toMatch(/max open trades/);
  });

  it('rejects duplicate same-direction positions by default', () => {
    const d = new RiskEngine().evaluate(ctx({ openTrades: [open('BTC', 'BUY', 1, 100)] }));
    expect(d.allowed).toBe(false);
    expect(d.reasons.join()).toMatch(/duplicate/);
  });

  it('allows pyramiding when explicitly enabled', () => {
    const d = new RiskEngine().evaluate(ctx({ openTrades: [open('BTC', 'BUY', 1, 100)], allowPyramiding: true }));
    expect(d.allowed).toBe(true);
  });

  it('blocks orders after the daily loss limit is hit', () => {
    const d = new RiskEngine().evaluate(ctx({ todayRealizedPnL: -300, risk: { ...baseRisk, maxDailyLossPct: 2 } }));
    expect(d.allowed).toBe(false);
    expect(d.reasons.join()).toMatch(/daily loss/);
  });

  it('engages the drawdown kill switch', () => {
    const d = new RiskEngine().evaluate(ctx({ drawdownPct: 12, risk: { ...baseRisk, maxDrawdownPct: 10 } }));
    expect(d.allowed).toBe(false);
    expect(d.reasons.join()).toMatch(/kill switch/);
  });

  it('rejects when exposure cap would be exceeded', () => {
    const openTrades = [open('ETH', 'BUY', 10, 200)];
    const d = new RiskEngine().evaluate(ctx({ openTrades, risk: { ...baseRisk, maxExposurePct: 20 } }));
    expect(d.allowed).toBe(false);
    expect(d.reasons.join()).toMatch(/exposure/);
  });

  it('rejects when notional exceeds the order cap', () => {
    const d = new RiskEngine().evaluate(ctx({ risk: { ...baseRisk, maxOrderNotional: 500 } }));
    expect(d.allowed).toBe(false);
  });

  it('rejects when balance is insufficient', () => {
    const d = new RiskEngine().evaluate(ctx({ balance: 100, risk: { ...baseRisk, positionSize: 1000 } }));
    expect(d.allowed).toBe(false);
    expect(d.reasons.join()).toMatch(/insufficient/);
  });
});

describe('RiskEngine.validateForLive', () => {
  it('requires stop loss, sizing and a drawdown kill switch', () => {
    const issues = new RiskEngine().validateForLive({});
    expect(issues).toContain('stop loss is required for live trading');
    expect(issues).toContain('position size or risk per trade must be set');
    expect(issues).toContain('a max drawdown kill switch is required');
  });
  it('passes a fully specified config', () => {
    const issues = new RiskEngine().validateForLive({
      stopLossPct: 2, positionSize: 1000, maxDrawdownPct: 15,
    });
    expect(issues).toEqual([]);
  });
});
