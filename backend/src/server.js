require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth.routes');
const strategyRoutes = require('./routes/strategy.routes');
const marketRoutes = require('./routes/market.routes');
const backtestRoutes = require('./routes/backtest.routes');
const tradeRoutes = require('./routes/trade.routes');
const aiRoutes = require('./routes/ai.routes');
const botRoutes = require('./routes/bot.routes');
const marketplaceRoutes = require('./routes/marketplace.routes');
const alertRoutes = require('./routes/alert.routes');
const journalRoutes = require('./routes/journal.routes');
const brokerRoutes = require('./routes/broker.routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/auth', authRoutes);
app.use('/strategies', strategyRoutes);
app.use('/market', marketRoutes);
app.use('/backtest', backtestRoutes);
app.use('/api', tradeRoutes); // /api/trades, /api/portfolio, /api/logs
app.use('/ai', aiRoutes);
app.use('/bots', botRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/alerts', alertRoutes);
app.use('/journal', journalRoutes);
app.use('/brokers', brokerRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ---------- WebSocket: authenticated, per-user routing ----------
const wss = new WebSocketServer({ server, path: '/ws' });
const socketsByUser = new Map(); // userId -> Set<ws>

function addSocket(userId, ws) {
  if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
  socketsByUser.get(userId).add(ws);
}
function removeSocket(userId, ws) {
  socketsByUser.get(userId)?.delete(ws);
  if (socketsByUser.get(userId)?.size === 0) socketsByUser.delete(userId);
}
function sendToUser(userId, msg) {
  const data = JSON.stringify(msg);
  for (const ws of socketsByUser.get(userId) || []) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token');
  let userId = null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
      userId = payload.id;
    } catch {
      userId = null;
    }
  }
  if (!userId) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  addSocket(userId, ws);
  ws.send(JSON.stringify({ type: 'READY', msg: 'Connected to market feed' }));
  ws.on('close', () => removeSocket(userId, ws));
  ws.on('error', () => removeSocket(userId, ws));
});

// ---------- Bus: engine events + notifications ----------
const { Channels, getBus } = require('./modules/bus');
const bus = getBus();

bus.subscribe(Channels.ENGINE_EVENTS, (event) => {
  const e = event || {};
  if (e.userId) {
    sendToUser(e.userId, { type: 'SIGNAL', ...(e.payload || {}) });
  }
});

// ---------- Periodic market quote feed ----------
const { getQuote, SYMBOLS } = require('./services/market');
setInterval(async () => {
  try {
    const quotes = [];
    for (const symbol of SYMBOLS) {
      const q = await getQuote(symbol);
      if (q) quotes.push(q);
    }
    broadcast({ type: 'QUOTES', quotes, time: Date.now() });
    await bus.publish(Channels.QUOTES, { quotes, time: Date.now() });
  } catch {}
}, 15000);

// ---------- Automated trading engine ----------
// With Redis + external worker: engine runs as its own process (`npm run engine`).
// Without: fall back to an inline loop so the demo works out of the box.
const ENGINE_EXTERNAL = process.env.ENGINE_EXTERNAL === '1';
if (!ENGINE_EXTERNAL) {
  const { tick } = require('./modules/engine/runner');
  setInterval(() => {
    tick(new Date()).catch((err) => console.error('[engine] tick failed:', err.message));
  }, Number(process.env.ENGINE_INTERVAL_MS || 15000));
  tick(new Date()).catch(() => {});
}

server.listen(PORT, () => {
  console.log(`[server] Algorithmic Trading backend on http://localhost:${PORT}`);
  console.log(`[server] WebSocket feed on ws://localhost:${PORT}/ws`);
  console.log(`[server] engine: ${ENGINE_EXTERNAL ? 'external worker' : 'inline'}`);
  console.log(`[server] bus: ${bus.usingRedis ? 'redis' : 'in-memory'}`);
  const { seedMarketplace } = require('./seed/marketplace');
  seedMarketplace();
});