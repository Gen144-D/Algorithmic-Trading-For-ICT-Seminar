<div align="center">

# ⚡ Algorithmic Trading System

### AI-Assisted Strategy Development • Backtesting • Real-Time Trading Simulation

<img
src="https://capsule-render.vercel.app/api?type=waving&color=0:020617,35:0F172A,65:1D4ED8,100:06B6D4&height=220&section=header&text=ALGORITHMIC%20TRADING&fontSize=42&fontColor=FFFFFF&animation=fadeIn&fontAlignY=38"
width="100%"
/>

<br/>

<p>
  <strong>
    Market Data → Strategy → AI Analysis → Decision → Execution → Monitoring
  </strong>
</p>

<p>
  A full-stack algorithmic trading platform for developing strategies,
  backtesting historical market data, and running automated paper-trading
  simulations with AI-assisted analysis.
</p>

<br/>

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge\&logo=react\&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge\&logo=node.js\&logoColor=white)
![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?style=for-the-badge\&logo=python\&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge\&logo=mysql\&logoColor=white)

<br/>

![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square\&logo=docker\&logoColor=white)
![WebSocket](https://img.shields.io/badge/Real--Time-WebSocket-010101?style=flat-square\&logo=socketdotio)
![JWT](https://img.shields.io/badge/Auth-JWT-black?style=flat-square\&logo=jsonwebtokens)
![Status](https://img.shields.io/badge/Status-Active%20Development-F59E0B?style=flat-square)

</div>

---

## 🧠 The Idea

This system brings the core algorithmic trading workflow into one platform:

```text
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     📊 MARKET DATA                                          ║
║          │                                                   ║
║          ▼                                                   ║
║     🧠 ALGORITHM                                             ║
║          │                                                   ║
║          ▼                                                   ║
║     🤖 AI ANALYSIS                                          ║
║          │                                                   ║
║          ▼                                                   ║
║     ⚡ TRADING DECISION                                      ║
║          │                                                   ║
║          ▼                                                   ║
║     💹 ORDER / OUTPUT                                        ║
║          │                                                   ║
║          ▼                                                   ║
║     📈 MONITORING                                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

The platform allows users to:

* Create or select trading strategies
* Configure trading rules
* Backtest strategies using historical data
* Analyze performance
* Activate strategies
* Generate automated trading signals
* Simulate order execution
* Monitor positions and trades
* Use AI-assisted market analysis

---

# 🚀 Core Trading Loop

<div align="center">

### 📊 → 🧠 → 🤖 → ⚡ → 💹 → 📈

**Market Data → Algorithm → AI Analysis → Decision → Order → Monitoring**

</div>

```text
                    ┌──────────────────┐
                    │   MARKET DATA    │
                    │                  │
                    │ Historical / Live│
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ STRATEGY ENGINE  │
                    │                  │
                    │ Indicators       │
                    │ Conditions       │
                    │ Rules            │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   AI ANALYSIS    │
                    │                  │
                    │ Context          │
                    │ Risk             │
                    │ Explanation      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ TRADING DECISION │
                    │                  │
                    │ BUY / SELL / HOLD│
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ TRADING ENGINE   │
                    │                  │
                    │ Risk Validation  │
                    │ Position Sizing  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ PAPER EXECUTION  │
                    │                  │
                    │ Simulated Orders  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   MONITORING     │
                    │                  │
                    │ P&L / Positions  │
                    │ Trades / Logs    │
                    └──────────────────┘
```

---

# ✨ What Makes It Different

### 🔬 Strategy First

Strategies can be created, configured, tested, and evaluated before activation.

### 📊 Data Driven

Historical and real-time market data feed the same trading workflow.

### 🤖 AI Assisted

AI analysis provides additional context around market conditions and strategy signals.

### 🛡️ Risk Aware

Risk controls are integrated into the trading engine instead of being treated as an afterthought.

### ⚡ Real-Time

WebSocket market feeds allow the dashboard to reflect trading activity as it happens.

### 🧪 Paper Trading

The system simulates execution so strategies can be tested without placing real financial orders.

---

# 🏗️ System Architecture

```text
                              ┌───────────────────────┐
                              │       FRONTEND        │
                              │                       │
                              │ React + Vite          │
                              │ Tailwind CSS          │
                              │ Dashboard             │
                              │ Strategy Builder      │
                              │ Backtesting           │
                              │ Analytics             │
                              └───────────┬───────────┘
                                          │
                                   REST / WebSocket
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │       BACKEND         │
                              │                       │
                              │ Node.js + Express     │
                              │ JWT Authentication    │
                              │ REST API              │
                              │ WebSocket Server      │
                              └───────────┬───────────┘
                                          │
                ┌─────────────────────────┼────────────────────────┐
                │                         │                        │
                ▼                         ▼                        ▼
      ┌──────────────────┐      ┌──────────────────┐      ┌─────────────────┐
      │   AI SERVICE     │      │ TRADING ENGINE   │      │    DATABASE     │
      │                  │      │                  │      │                 │
      │ FastAPI          │      │ Strategy Rules   │      │ MySQL           │
      │ Python           │      │ Signals          │      │                 │
      │ AI Analysis      │      │ Risk Controls    │      │ Users           │
      │ ML Hooks         │      │ Orders           │      │ Strategies      │
      └──────────────────┘      └──────────────────┘      │ Trades          │
                                                          │ Positions       │
                                                          └────────┬────────┘
                                                                   │
                                                                   ▼
                                                        ┌──────────────────┐
                                                        │   MARKET DATA    │
                                                        │                  │
                                                        │ External API     │
                                                        │       or         │
                                                        │ Synthetic Data   │
                                                        └──────────────────┘
```

---

# 🧩 Architecture at a Glance

| Component         | Technology               | Responsibility        |
| ----------------- | ------------------------ | --------------------- |
| 🖥️ Frontend      | React + Vite + Tailwind  | Trading interface     |
| ⚙️ Backend        | Node.js + Express + TS   | API & orchestration   |
| 🤖 AI Service     | FastAPI + Python         | AI analysis           |
| 🧠 Trading Engine | TypeScript worker        | Strategy execution    |
| 🗄️ Database      | MySQL (fallback in-memory) | Persistent data     |
| ⚡ Message Bus    | Redis (fallback in-memory) | Engine ↔ server events |
| 📡 Market Data    | Binance / TwelveData / Synthetic | Price feeds     |
| 🏦 Broker Adapter | Paper + Alpaca (extensible) | Order execution   |
| 🔐 Authentication | JWT + refresh tokens + 2FA | User authentication |
| ⚡ Real-Time       | WebSocket (authenticated) | Live updates          |
| 🐳 Deployment     | Docker Compose (with engine worker) | Service orchestration |

---

# 📈 Trading Engine

The trading engine is responsible for converting strategy conditions into simulated trading actions.

```text
Market Tick
     │
     ▼
┌──────────────┐
│ Data Update  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Indicators   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Strategy     │
│ Evaluation   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Signal       │
│ BUY/SELL/HOLD│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Risk Check   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Paper Order  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Position     │
│ Update       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Portfolio    │
│ Analytics    │
└──────────────┘
```

---

# 🔬 Backtesting Workflow

Before activating a strategy, it can be evaluated against historical market data.

```text
              HISTORICAL DATA
                     │
                     ▼
              ┌──────────────┐
              │ Select Asset │
              │ & Timeframe  │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │ Configure    │
              │ Strategy     │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │ Run          │
              │ Backtest     │
              └──────┬───────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ Simulated Execution  │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ Performance Analysis │
          └──────────┬───────────┘
                     │
              ┌──────┴───────┐
              ▼              ▼
          ACCEPT          IMPROVE
              │              │
              └──────┬───────┘
                     │
                     ▼
                NEXT TEST
```

---

# 🤖 AI-Assisted Analysis

The AI service provides additional context around market and strategy behavior.

### Example

```text
USER
"Why did my strategy generate a SELL signal?"

                 │
                 ▼

        ┌──────────────────┐
        │   AI SERVICE     │
        ├──────────────────┤
        │ Market Context   │
        │ Indicators       │
        │ Strategy Rules   │
        │ Risk Conditions  │
        └────────┬─────────┘
                 │
                 ▼

        ┌──────────────────┐
        │ AI Explanation   │
        │                  │
        │ Signal Context   │
        │ Risk Factors     │
        │ Market Conditions│
        └──────────────────┘
```

AI is designed as **decision support and analysis**, rather than blindly controlling the trading engine.

---

# 🛡️ Risk Management

The platform includes several risk-management concepts:

* Stop-loss
* Take-profit
* Position sizing
* Maximum open trades
* Strategy validation
* Trade history
* Activity logs
* Backtesting before activation
* Graceful market-data failure handling

```text
                STRATEGY SIGNAL
                       │
                       ▼
               ┌──────────────┐
               │  RISK CHECK  │
               └──────┬───────┘
                      │
             ┌────────┴────────┐
             │                 │
           PASS              FAIL
             │                 │
             ▼                 ▼
        EXECUTE             REJECT
          ORDER              SIGNAL
```

---

# ⚡ Real-Time Data

The platform uses WebSockets to deliver real-time updates between the trading engine and frontend.

```text
              MARKET DATA
                   │
                   ▼
            ┌─────────────┐
            │ Trading     │
            │ Engine      │
            └──────┬──────┘
                   │
              WebSocket
                   │
                   ▼
            ┌─────────────┐
            │   Backend   │
            └──────┬──────┘
                   │
              WebSocket
                   │
                   ▼
            ┌─────────────┐
            │  Dashboard  │
            └─────────────┘
```

This allows the UI to reflect:

* Live prices
* Strategy signals
* Orders
* Position changes
* Portfolio values
* Trading activity

---

# 📁 Repository Layout

```text
algorithmic-trading-system/
│
├── database/
│   └── schema.sql
│
├── backend/
│   ├── src/
│   │   ├── routes/            # REST endpoints (auth, strategies, bots, backtest,
│   │   │                      #   market, marketplace, brokers, alerts, journal, trade)
│   │   ├── services/          # JS bridges to the TS market data layer
│   │   ├── modules/           # TypeScript core: indicators, risk, engine, bus,
│   │   │                      #   market providers, broker adapters, totp
│   │   ├── data/              # mysql.js + memory.js stores
│   │   ├── config/            # DB/store wiring
│   │   ├── middleware/        # auth (JWT, pending-2FA)
│   │   ├── seed/              # marketplace seeding
│   │   ├── engine/            # standalone engine worker entrypoint
│   │   ├── test/              # vitest suites (indicators, risk, engine)
│   │   └── server.js
│   ├── tsconfig.json
│   └── package.json
│
├── ai-service/
│   ├── main.py
│   ├── models/
│   ├── services/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Layout, CandleChart, StatCard, ProtectedRoute
│   │   ├── pages/             # Dashboard, Market, Strategies, StrategyBuilder,
│   │   │                      #   Backtest, Bots, Marketplace, Brokers, Alerts,
│   │   │                      #   Journal, Analytics, AIAssistant, Login, Register
│   │   ├── api/               # client.js (refresh tokens, WS token)
│   │   ├── context/           # AuthContext (2FA + refresh)
│   │   └── hooks/             # useWebSocket
│   └── package.json
│
├── .github/workflows/ci.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 🚀 Quick Start

## 1. Backend

```bash
cd backend
npm install
npm run dev
```

**Port:** `5000`

Useful scripts:

```bash
npm run typecheck   # TypeScript type checking (tsc --noEmit)
npm test            # vitest suite (indicators, risk engine, backtest engine)
npm run engine      # run the trading engine as an external worker (uses Redis bus)
```

The backend automatically uses an in-memory database when MySQL is unavailable,
and an in-memory message bus when Redis is unavailable.

For MySQL, configure the `DB_*` variables in:

```text
backend/.env
```

Then import:

```text
database/schema.sql
```

---

## 2. AI Service

```bash
cd ai-service

python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### macOS / Linux

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn main:app --reload --port 8000
```

**Port:** `8000`

---

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

**Port:** `5173`

Open:

```text
http://localhost:5173
```

---

# 🐳 Docker

Run the complete system (MySQL + Redis + backend + engine worker + AI + frontend) using Docker Compose:

```bash
docker compose up --build
```

Stop the services:

```bash
docker compose down
```

View running services:

```bash
docker compose ps
```

---

# 🔐 Environment Configuration

Each service provides an `.env.example`.

Create the appropriate environment file:

```bash
cp .env.example .env
```

Typical configuration includes:

```env
DATABASE_URL=
JWT_SECRET=
BROKER_ENC_KEY=

REDIS_URL=
ENGINE_EXTERNAL=1
ENGINE_INTERVAL_MS=15000

MARKET_DATA_API_KEY=
MARKET_DATA_API_BASE=
BINANCE_API_BASE=

AI_SERVICE_URL=
```

> Never commit production secrets or API keys to the repository.

---

# 📊 Market Data

The system supports three data modes, with automatic fallback.

### Synthetic Data

The default development mode generates synthetic candles so the system can operate without an external market-data provider.

### Real Data

Providers are queried in priority order:

* **Binance** (`https://api.binance.com`) — live candles and 24h tickers for crypto symbols (`BTC`, `ETH`, `SOL`, `XRP`, …)
* **TwelveData** — stocks, ETFs and forex when `MARKET_DATA_API_KEY` is set
* **Synthetic fallback** — used when no provider is available for a symbol

```env
MARKET_DATA_API_KEY=
MARKET_DATA_API_BASE=https://api.twelvedata.com
BINANCE_API_BASE=https://api.binance.com
```

If an external provider fails, the system falls back to synthetic market data so the platform keeps running.

---

# 🏦 Broker Connectivity

Bots run in two modes:

* **Paper** (default) — simulated execution against the built-in paper account
* **Live** — routed through a connected broker adapter (Alpaca), gated by a connectivity test and a kill-switch (`live_enabled`)

Credentials are encrypted at rest (AES-256-GCM) using `BROKER_ENC_KEY`. A live bot cannot start unless its strategy passes `riskEngine.validateForLive()` (requires explicit stop-loss and position-sizing rules).

---

# 🧪 Example User Journey

```text
       REGISTER
          │
          ▼
     DASHBOARD
          │
          ▼
   SELECT STRATEGY
          │
          ▼
   CONFIGURE RULES
          │
          ▼
      BACKTEST
          │
          ▼
   ANALYZE RESULTS
          │
          ▼
      ACTIVATE
          │
          ▼
   PAPER TRADING
          │
          ▼
  MONITOR PERFORMANCE
          │
          ▼
      AI ANALYSIS
```

---

# 📈 Performance Metrics

The platform can evaluate strategies using:

| Metric               | Purpose                     |
| -------------------- | --------------------------- |
| **Total P&L**        | Overall profitability       |
| **Win Rate**         | Successful trade percentage |
| **Profit Factor**    | Gross profit vs. gross loss |
| **Maximum Drawdown** | Largest portfolio decline   |
| **Sharpe Ratio**     | Risk-adjusted performance   |
| **Total Trades**     | Number of executed trades   |
| **Average Trade**    | Average trade performance   |
| **Equity Curve**     | Portfolio growth            |
| **Open Positions**   | Current exposure            |

---

# 🗺️ Development Roadmap

### Phase 1 — Foundation

* [x] React frontend
* [x] Express backend
* [x] FastAPI AI service
* [x] JWT authentication
* [x] Database integration
* [x] Synthetic market data
* [x] WebSocket foundation

### Phase 2 — Strategy Engine

* [x] Strategy creation
* [x] Strategy activation
* [x] Rule-based signals
* [x] Risk controls
* [x] Advanced strategy builder
* [x] Multi-strategy execution (bot ecosystem)

### Phase 3 — Backtesting

* [x] Historical data workflow
* [x] Trade simulation
* [x] Performance metrics (Sortino, annualized, expectancy)
* [x] Fees, slippage and shorting simulation
* [x] Parameter optimization (grid search)
* [x] Walk-forward analysis
* [ ] Strategy comparison

### Phase 4 — AI

* [x] AI service
* [x] Market analysis
* [x] AI-assisted explanations
* [ ] Context-aware recommendations
* [ ] Advanced strategy analysis

### Phase 5 — Platform Features

* [x] Trading bots (paper + live gating)
* [x] Bot marketplace with one-click install
* [x] Broker connections (Alpaca) with encrypted credentials
* [x] Price alerts
* [x] Trade journal
* [x] Two-factor authentication + refresh tokens
* [x] Redis message bus + external engine worker
* [x] CI/CD workflow
* [ ] Monitoring & observability
* [ ] Performance optimization

---

# 🧱 Engineering Principles

### Modular

Each major responsibility is separated into its own service.

### Testable

Strategies can be evaluated using historical data before activation.

### Observable

Trading activity, orders, positions, and system events are tracked.

### Resilient

External market-data failures do not immediately bring down the platform.

### Explainable

AI analysis is intended to help users understand signals and market conditions.

### Scalable

The architecture separates frontend, backend, AI, trading, and database responsibilities so individual services can evolve independently.

---

# ⚠️ Disclaimer

This project is intended for **educational, research, and software-development purposes**.

Paper trading and backtesting are simulations. Historical performance does not guarantee future results, and simulated execution may differ significantly from live market execution due to factors such as slippage, spreads, latency, liquidity, and market conditions.

AI-generated analysis should not be considered financial advice.

**This system does not execute real-money trades by default.**

---

<div align="center">

# ⚡ MARKET → ALGORITHM → AI → DECISION → EXECUTION

### Build strategies. Backtest ideas. Simulate markets.

<br/>

<img
src="https://capsule-render.vercel.app/api?type=waving&color=0:020617,35:0F172A,65:1D4ED8,100:06B6D4&height=130&section=footer"
width="100%"
/>

<br/>

**Algorithmic Trading System**

<sub>Built for algorithmic trading research, strategy development, and paper-trading simulation.</sub>

</div>
