# Algorithmic Trading System

A full-stack algorithmic trading system that lets users define or select trading
strategies, backtest them on historical market data, and run them against an
automated trading engine with AI-assisted analysis.

Core flow (matches the seminar concept):
**market data → algorithm → decision → order/output → monitoring**

## Architecture

| Component       | Technology                          |
| --------------- | ----------------------------------- |
| Frontend        | React (Vite) + Tailwind CSS         |
| Backend         | Node.js / Express.js                |
| API / AI        | FastAPI + Python                    |
| Database        | MySQL (in-memory fallback for demo) |
| AI              | Python heuristics + ML-ready hooks  |
| Market Data     | External API hook + synthetic data  |
| Authentication  | JWT                                 |
| Real-Time Data  | WebSocket (market feed)             |
| Trading Engine  | Python/Node rules engine            |
| Deployment      | Docker / Cloud                      |

```
Frontend (React) ──REST/WS──► Backend (Express)
                                  ├──► FastAPI AI service (analysis / chat)
                                  ├──► Trading Engine (rules → signal → order)
                                  └──► DB (MySQL or in-memory)
                                       └──► Market Data (external API or synthetic)
```

## Repository layout

```
database/       MySQL schema (schema.sql)
backend/        Node.js/Express REST + WebSocket API
ai-service/     FastAPI AI analysis service
frontend/       React + Tailwind UI
docker-compose.yml  Full deployment (requires Docker)
```

## Quick start

### 1. Backend (port 5000)

```bash
cd backend
npm install
npm run dev
```

Uses an in-memory database automatically when MySQL is unreachable.
To use MySQL, set `DB_*` in `backend/.env` (see `.env.example`) and import
`database/schema.sql`.

### 2. AI service (port 8000)

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — register a user, create a strategy, backtest it,
activate it, then watch the trading engine generate signals on the dashboard.

## Environment variables

Copy the relevant `.env.example` to `.env` in each service and adjust.

## Default credentials / demo users

- Register your own account via the UI (signup is open).
- Market data is synthetic by default; set `MARKET_DATA_API_KEY` +
  `MARKET_DATA_API_BASE` to use a real provider (e.g. TwelveData) — the
  adapter polls the provider and falls back to synthetic candles on failure.

## Risks addressed (from seminar)

- Backtesting/validation before activation
- Risk management: stop-loss, take-profit, position sizing, max open trades
- Activity logs and trade history for monitoring
- Graceful failure when external data sources are unavailable
