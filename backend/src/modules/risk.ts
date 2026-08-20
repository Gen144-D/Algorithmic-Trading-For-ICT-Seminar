// Standalone Risk Engine.
// Every order — from bots or manual trading — passes through this gate before
// it reaches a broker adapter. It enforces both per-strategy rules and
// account-level protection (daily loss, drawdown kill-switch, exposure).

import type { OrderSide, RiskConfig, Trade } from './types';

export interface RiskContext {
  userId: string;
  balance: number; // cash balance (USD)
  equity: number; // balance + unrealized P/L
  drawdownPct: number; // current drawdown from account peak
  symbol: string;
  side: OrderSide;
  price: number;
  risk: RiskConfig;
  openTrades: Trade[];
  todayRealizedPnL: number; // realized P/L since local midnight
  allowPyramiding?: boolean;
}

export interface RiskDecision {
  allowed: boolean;
  reasons: string[]; // human-readable explanation of the outcome
  quantity: number; // final (risk-adjusted) quantity
  notional: number;
  riskAmount: number;
}

/** Sizes a position from a strategy's risk config and returns target notional. */
export function sizePosition(risk: RiskConfig, balance: number, entryPrice: number): { notional: number; riskAmount: number } {
  const sl = (risk.stopLossPct ?? 0) / 100;

  if ((risk.riskPerTradePct ?? 0) > 0 && sl > 0) {
    const riskAmount = balance * ((risk.riskPerTradePct ?? 0) / 100);
    // notional = riskAmount / sl  (so a stop-out loses exactly riskPerTradePct)
    return { notional: riskAmount / sl, riskAmount };
  }

  const notional = risk.positionSize ?? 1000;
  return { notional, riskAmount: notional * sl };
}

function notionalOf(t: Trade): number {
  return t.quantity * t.entry_price;
}

export class RiskEngine {
  /** Evaluates whether an order may proceed. Pure — no side effects. */
  evaluate(ctx: RiskContext): RiskDecision {
    const reasons: string[] = [];
    const { risk, openTrades, side, price, symbol } = ctx;
    const { notional, riskAmount } = sizePosition(risk, ctx.balance, price);
    const quantity = notional / price;

    let allowed = true;

    // 1. Max concurrent positions
    const maxOpen = risk.maxOpenTrades ?? 3;
    if (openTrades.length >= maxOpen) {
      allowed = false;
      reasons.push(`max open trades reached (${openTrades.length}/${maxOpen})`);
    }

    // 2. No duplicate same-direction position on the same symbol (anti-pyramiding)
    if (!ctx.allowPyramiding) {
      const dup = openTrades.some((t) => t.symbol === symbol && t.side === side);
      if (dup) {
        allowed = false;
        reasons.push(`duplicate ${side} position already open on ${symbol}`);
      }
    }

    // 3. Daily loss limit
    const maxDailyLoss = risk.maxDailyLossPct ?? 0;
    if (maxDailyLoss > 0) {
      const limit = (ctx.balance * maxDailyLoss) / 100;
      if (ctx.todayRealizedPnL <= -limit) {
        allowed = false;
        reasons.push(`daily loss limit hit (${ctx.todayRealizedPnL.toFixed(2)} ≤ -${limit.toFixed(2)})`);
      }
    }

    // 4. Drawdown kill switch
    const maxDd = risk.maxDrawdownPct ?? 0;
    if (maxDd > 0 && ctx.drawdownPct >= maxDd) {
      allowed = false;
      reasons.push(`drawdown kill switch engaged (${ctx.drawdownPct.toFixed(2)}% ≥ ${maxDd}%)`);
    }

    // 5. Account exposure cap
    const maxExposure = risk.maxExposurePct ?? 0;
    if (maxExposure > 0) {
      const exposure = openTrades.reduce((a, t) => a + notionalOf(t), 0) + notional;
      const cap = (ctx.equity * maxExposure) / 100;
      if (exposure > cap) {
        allowed = false;
        reasons.push(`exposure would exceed ${maxExposure}% cap (${exposure.toFixed(2)} > ${cap.toFixed(2)})`);
      }
    }

    // 6. Max order notional
    const maxNotional = risk.maxOrderNotional ?? 0;
    if (maxNotional > 0 && notional > maxNotional) {
      allowed = false;
      reasons.push(`order notional ${notional.toFixed(2)} exceeds cap ${maxNotional}`);
    }

    // 7. Available balance
    if (side === 'BUY' && notional > ctx.balance) {
      allowed = false;
      reasons.push(`insufficient balance (need ${notional.toFixed(2)}, have ${ctx.balance.toFixed(2)})`);
    }

    return {
      allowed,
      reasons: allowed ? ['risk check passed'] : reasons,
      quantity: allowed ? quantity : 0,
      notional: allowed ? notional : 0,
      riskAmount,
    };
  }

  /** Requires that a strategy has SL/TP and sane position sizing before live mode. */
  validateForLive(risk: RiskConfig): string[] {
    const issues: string[] = [];
    if (!risk.stopLossPct || risk.stopLossPct <= 0) issues.push('stop loss is required for live trading');
    if ((risk.positionSize ?? 0) <= 0 && (risk.riskPerTradePct ?? 0) <= 0) {
      issues.push('position size or risk per trade must be set');
    }
    if ((risk.maxDrawdownPct ?? 0) <= 0) issues.push('a max drawdown kill switch is required');
    return issues;
  }
}

export const riskEngine = new RiskEngine();
