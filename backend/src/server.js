require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const authRoutes = require('./routes/auth.routes');
const strategyRoutes = require('./routes/strategy.routes');
const marketRoutes = require('./routes/market.routes');
const backtestRoutes = require('./routes/backtest.routes');
const tradeRoutes = require('./routes/trade.routes');
const aiRoutes = require('./routes/ai.routes');
const { notFound, errorHandler } = require('./middleware/error');
const { runEngine } = require('./services/executor');

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

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Real-time market feed + engine events
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'READY', msg: 'Connected to market feed' }));
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(data);
  }
}

// periodic market broadcast
setInterval(async () => {
  try {
    const { getQuote, SYMBOLS } = require('./services/market');
    const quotes = [];
    for (const symbol of SYMBOLS) {
      const q = await getQuote(symbol);
      if (q) quotes.push(q);
    }
    broadcast({ type: 'QUOTES', quotes, time: Date.now() });
  } catch {}
}, 15000);

// automated trading engine tick
setInterval(async () => {
  try {
    await runEngine(broadcast);
  } catch (err) {
    console.error('[engine] tick failed:', err.message);
  }
}, Number(process.env.ENGINE_INTERVAL_MS || 15000));

server.listen(PORT, () => {
  console.log(`[server] Algorithmic Trading backend on http://localhost:${PORT}`);
  console.log(`[server] WebSocket feed on ws://localhost:${PORT}/ws`);
  runEngine(broadcast).catch(() => {});
});
