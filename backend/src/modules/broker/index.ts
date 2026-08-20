// Broker adapter layer.
// Every execution path goes through a BrokerAdapter. PaperBroker is the default
// in-memory/account simulator; AlpacaBroker provides real US-stock trading
// (paper or live) via REST. Additional adapters (Binance/Bybit/Oanda) implement
// the same interface.

import type { OrderSide, Position } from '../types';

export interface BrokerAccount {
  id: string;
  balance: number;
  equity: number;
  buyingPower: number;
  currency: string;
  mode: 'paper' | 'live';
}

export interface BrokerOrderRequest {
  symbol: string;
  side: OrderSide;
  quantity: number;
  type?: 'market' | 'limit';
  limitPrice?: number;
}

export interface BrokerOrderResult {
  id: string;
  status: string;
  filledQty: number;
  filledPrice: number;
}

export interface BrokerAdapter {
  readonly name: string;
  connect(): Promise<void>;
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<Position[]>;
  placeOrder(req: BrokerOrderRequest): Promise<BrokerOrderResult>;
  cancelOrder(orderId: string): Promise<boolean>;
}

// ---------- Paper broker ----------
// Simulated execution. Kept isolated so real adapters can replace it.

interface PaperState {
  balance: number;
  positions: Map<string, Position>;
  nextId: number;
}

export class PaperBroker implements BrokerAdapter {
  readonly name = 'paper';
  private state: PaperState;
  private prices: Record<string, number> = {};

  constructor(initialBalance = 10000) {
    this.state = {
      balance: initialBalance,
      positions: new Map(),
      nextId: 1,
    };
  }

  setPrices(prices: Record<string, number>): void {
    this.prices = prices;
  }

  async connect(): Promise<void> {
    return;
  }

  async getAccount(): Promise<BrokerAccount> {
    let unrealized = 0;
    for (const p of this.state.positions.values()) {
      unrealized += (this.prices[p.symbol] ?? p.entry_price) * p.quantity - p.entry_price * p.quantity;
    }
    return {
      id: 'paper',
      balance: this.state.balance,
      equity: this.state.balance + unrealized,
      buyingPower: this.state.balance,
      currency: 'USD',
      mode: 'paper',
    };
  }

  async getPositions(): Promise<Position[]> {
    return [...this.state.positions.values()].map((p) => ({
      ...p,
      current_price: this.prices[p.symbol] ?? p.entry_price,
      unrealized_pnl: ((this.prices[p.symbol] ?? p.entry_price) - p.entry_price) * p.quantity,
    }));
  }

  async placeOrder(req: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const price = req.type === 'limit' ? req.limitPrice ?? 0 : this.prices[req.symbol] ?? 0;
    if (price <= 0) throw new Error(`No price available for ${req.symbol}`);
    const cost = price * req.quantity;
    if (req.side === 'BUY' && cost > this.state.balance) throw new Error('Insufficient paper balance');
    if (req.side === 'BUY') {
      this.state.balance -= cost;
      const existing = this.state.positions.get(req.symbol);
      if (existing) {
        existing.quantity += req.quantity;
        existing.entry_price = (existing.entry_price * existing.quantity + cost) / existing.quantity;
      } else {
        this.state.positions.set(req.symbol, {
          id: `p${this.state.nextId++}`,
          user_id: 'paper',
          symbol: req.symbol,
          side: 'BUY',
          quantity: req.quantity,
          entry_price: price,
          current_price: price,
          unrealized_pnl: 0,
          opened_at: new Date().toISOString(),
        });
      }
    } else {
      const pos = this.state.positions.get(req.symbol);
      if (!pos || pos.quantity < req.quantity) throw new Error('Insufficient paper position');
      this.state.balance += cost;
      pos.quantity -= req.quantity;
      if (pos.quantity === 0) this.state.positions.delete(req.symbol);
    }
    return {
      id: `o${this.state.nextId++}`,
      status: 'FILLED',
      filledQty: req.quantity,
      filledPrice: price,
    };
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    return true;
  }
}

// ---------- Alpaca broker ----------
// REST-based. Uses API key headers. Paper vs live via base URL.

export class AlpacaBroker implements BrokerAdapter {
  readonly name = 'alpaca';
  private apiKey: string;
  private secretKey: string;
  private base: string;

  constructor(apiKey: string, secretKey: string, mode: 'paper' | 'live') {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.base =
      mode === 'live'
        ? 'https://api.alpaca.markets'
        : 'https://paper-api.alpaca.markets';
  }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const resp = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        'APCA-API-KEY-ID': this.apiKey,
        'APCA-SECRET-KEY': this.secretKey,
        ...(init.headers || {}),
      },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Alpaca ${resp.status}: ${body.slice(0, 200)}`);
    }
    return resp.json();
  }

  async connect(): Promise<void> {
    await this.request('/v2/account');
  }

  async getAccount(): Promise<BrokerAccount> {
    const a = await this.request('/v2/account');
    return {
      id: a.id,
      balance: Number(a.cash),
      equity: Number(a.equity),
      buyingPower: Number(a.buying_power),
      currency: a.currency,
      mode: a.account_blocked ? 'live' : 'paper',
    };
  }

  async getPositions(): Promise<Position[]> {
    const rows = await this.request('/v2/positions');
    return rows.map((p: any) => ({
      id: p.asset_id,
      user_id: 'alpaca',
      symbol: p.symbol,
      side: Number(p.qty) >= 0 ? 'BUY' : 'SELL',
      quantity: Math.abs(Number(p.qty)),
      entry_price: Number(p.avg_entry_price),
      current_price: Number(p.current_price),
      unrealized_pnl: Number(p.unrealized_pl),
      opened_at: new Date().toISOString(),
    }));
  }

  async placeOrder(req: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const order = await this.request('/v2/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: req.symbol,
        qty: req.quantity,
        side: req.side.toLowerCase(),
        type: req.type || 'market',
        time_in_force: 'day',
        limit_price: req.type === 'limit' ? req.limitPrice : undefined,
      }),
    });
    return {
      id: order.id,
      status: order.status,
      filledQty: Number(order.filled_qty || 0),
      filledPrice: Number(order.filled_avg_price || 0),
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    await this.request(`/v2/orders/${orderId}`, { method: 'DELETE' });
    return true;
  }
}

export function createAdapter(broker: string, creds: Record<string, string>, mode: 'paper' | 'live'): BrokerAdapter {
  switch (broker) {
    case 'alpaca':
      return new AlpacaBroker(creds.apiKey, creds.secretKey, mode);
    case 'paper':
    default:
      return new PaperBroker();
  }
}
