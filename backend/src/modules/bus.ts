// Message bus abstraction.
// - With REDIS_URL set: Redis Pub/Sub (separate publish/subscribe connections so
//   same-process pub/sub also works).
// - Without Redis: an in-process EventEmitter (single-process dev mode).
// Channels are namespaced so engine events, quotes and user notifications can
// be routed independently.

import Redis from 'ioredis';
import { EventEmitter } from 'events';

export const Channels = {
  QUOTES: 'market:quotes',
  ENGINE_EVENTS: 'engine:events',
  NOTIFICATIONS: 'notify:',
  USER_EVENTS: 'user:events:',
} as const;

export type BusHandler = (payload: unknown, channel: string) => void;

export interface Bus {
  readonly usingRedis: boolean;
  publish(channel: string, payload: unknown): Promise<void>;
  subscribe(channel: string, handler: BusHandler): Promise<void>;
  disconnect(): Promise<void>;
}

class RedisBus implements Bus {
  readonly usingRedis = true;
  private sub: Redis | null;
  private pub: Redis | null;

  constructor(url: string) {
    this.sub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.pub = this.sub.duplicate();
    // Avoid crashing the app if Redis is temporarily unreachable.
    this.sub.on('error', () => {});
    this.pub.on('error', () => {});
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    try {
      await this.pub!.publish(channel, JSON.stringify(payload));
    } catch {
      // Redis down — drop rather than crash the engine loop.
    }
  }

  async subscribe(channel: string, handler: BusHandler): Promise<void> {
    try {
      await this.sub!.subscribe(channel);
    } catch {
      return;
    }
    this.sub!.on('message', (ch, raw) => {
      try {
        handler(JSON.parse(raw), ch);
      } catch {
        /* ignore malformed */
      }
    });
  }

  async disconnect(): Promise<void> {
    try {
      await this.sub?.quit();
      await this.pub?.quit();
    } catch {
      /* noop */
    }
  }
}

class MemoryBus implements Bus {
  readonly usingRedis = false;
  private emitter = new EventEmitter();

  async publish(channel: string, payload: unknown): Promise<void> {
    this.emitter.emit(channel, payload, channel);
  }

  async subscribe(channel: string, handler: BusHandler): Promise<void> {
    this.emitter.on(channel, (payload, ch) => handler(payload, ch));
  }

  async disconnect(): Promise<void> {
    this.emitter.removeAllListeners();
  }
}

let instance: Bus | null = null;

/** Creates (once) the process-wide bus. `url` overrides REDIS_URL. */
export function createBus(url?: string): Bus {
  if (instance) return instance;
  const redisUrl = url || process.env.REDIS_URL || '';
  instance = redisUrl ? new RedisBus(redisUrl) : new MemoryBus();
  return instance;
}

export function getBus(): Bus {
  return instance ?? createBus();
}

export function resetBus(): void {
  instance = null;
}
