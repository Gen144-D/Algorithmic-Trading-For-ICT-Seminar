"""AI Analysis service for the Algorithmic Trading System.

Provides optional analytical support on top of the rule-based trading engine:
- /analyze/market     technical read on a market snapshot
- /analyze/strategy   assessment of a strategy + backtest result
- /chat               natural-language assistant

The models here are deterministic heuristics (RSI, SMA trend, momentum). This is
the intended seam for plugging in real ML models later.
"""
import math
from typing import Any, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Trading AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Candle(BaseModel):
    ts: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = 0


class MarketRequest(BaseModel):
    symbol: str
    candles: List[Candle]


class StrategyRequest(BaseModel):
    strategy: dict[str, Any]
    backtestResult: dict[str, Any]


class ChatRequest(BaseModel):
    message: str
    context: Optional[dict[str, Any]] = None


# ---------- indicators (pure python) ----------

def sma(values: List[float], period: int) -> Optional[float]:
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def rsi(values: List[float], period: int = 14) -> Optional[float]:
    if len(values) < period + 1:
        return None
    gains = losses = 0.0
    for i in range(len(values) - period, len(values)):
        diff = values[i] - values[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses -= diff
    if losses == 0:
        return 100.0
    rs = gains / losses
    return 100 - 100 / (1 + rs)


def momentum(values: List[float], period: int = 10) -> Optional[float]:
    if len(values) < period + 1:
        return None
    return (values[-1] - values[-period]) / values[-period] * 100


# ---------- analysis ----------

def analyze_market(symbol: str, candles: List[Candle]) -> dict[str, Any]:
    closes = [c.close for c in candles]
    if len(closes) < 2:
        return {"symbol": symbol, "error": "Not enough data"}

    rsi_v = rsi(closes)
    sma_fast = sma(closes, 20)
    sma_slow = sma(closes, 50)
    mom = momentum(closes)

    score = 50  # neutral
    reasons: List[str] = []

    if rsi_v is not None:
        if rsi_v >= 70:
            score -= 15
            reasons.append(f"RSI {rsi_v:.0f} is overbought — pullback risk")
        elif rsi_v <= 30:
            score += 15
            reasons.append(f"RSI {rsi_v:.0f} is oversold — possible bounce")
        else:
            reasons.append(f"RSI {rsi_v:.0f} is neutral")

    if sma_fast and sma_slow:
        if sma_fast > sma_slow:
            score += 15
            reasons.append("Uptrend: fast SMA above slow SMA")
        else:
            score -= 15
            reasons.append("Downtrend: fast SMA below slow SMA")

    if mom is not None:
        score += max(-15, min(15, mom))
        reasons.append(f"10-bar momentum {mom:+.1f}%")

    score = max(0, min(100, score))
    if score >= 65:
        sentiment = "BULLISH"
    elif score <= 35:
        sentiment = "BEARISH"
    else:
        sentiment = "NEUTRAL"

    return {
        "symbol": symbol,
        "score": score,
        "sentiment": sentiment,
        "indicators": {"rsi": rsi_v, "sma_fast": sma_fast, "sma_slow": sma_slow, "momentum_10": mom},
        "reasons": reasons,
        "summary": (
            f"{symbol} looks {sentiment.lower()} "
            f"(confidence {score}/100). " + " ".join(reasons[:2])
        ),
    }


def analyze_strategy(strategy: dict, bt: dict) -> dict[str, Any]:
    checks: List[str] = []
    issues: List[str] = []

    if bt.get("numTrades", 0) < 5:
        issues.append("Fewer than 5 trades — results are not statistically meaningful")
    else:
        checks.append(f"{bt['numTrades']} trades analysed")

    if bt.get("winRate", 0) >= 50:
        checks.append(f"win rate {bt['winRate']}% is healthy")
    else:
        issues.append(f"win rate {bt['winRate']}% is below 50%")

    if bt.get("totalReturnPct", 0) > 0:
        checks.append(f"backtest return {bt['totalReturnPct']}% is positive")
    else:
        issues.append("backtest return is not positive")

    if bt.get("maxDrawdown", 0) > 25:
        issues.append(f"max drawdown {bt['maxDrawdown']}% exceeds 25% risk tolerance")

    pf = bt.get("profitFactor", 0)
    if pf >= 1.5:
        checks.append(f"profit factor {pf:.2f} is strong")
    elif 0 < pf < 1:
        issues.append(f"profit factor {pf:.2f} below 1 — expected losses")

    recommendation = "ACTIVATE" if len(issues) == 0 else "IMPROVE"
    return {
        "recommendation": recommendation,
        "checks": checks,
        "issues": issues,
        "summary": (
            f"Strategy is ready for live trading — all checks passed."
            if recommendation == "ACTIVATE"
            else f"Consider addressing: {'; '.join(issues)}"
        ),
    }


def chat_reply(message: str, context: dict | None) -> str:
    text = message.lower()
    if any(w in text for w in ["risk", "stop loss", "stop-loss", "take profit"]):
        return (
            "Risk management controls: stop-loss and take-profit percentages are set per "
            "strategy, position size determines capital per trade, and maxOpenTrades caps "
            "concurrent positions. The engine enforces these on every tick."
        )
    if any(w in text for w in ["backtest", "test", "win rate", "winrate"]):
        return (
            "Backtesting runs your strategy rules over historical candles and reports P/L, "
            "win rate, max drawdown, and an equity curve. Always validate a strategy before "
            "activating it."
        )
    if any(w in text for w in ["activate", "live", "deploy", "run"]):
        return (
            "Activating a strategy enables the automated engine: it fetches market data on "
            "each tick, evaluates your rules, and executes orders subject to risk controls. "
            "Activate only after a positive backtest."
        )
    if any(w in text for w in ["indicator", "sma", "rsi", "moving average"]):
        return (
            "Supported indicators include SMA (fast/slow crossover), RSI (overbought/"
            "oversold), and momentum. Combine a crossover with an RSI filter to reduce "
            "whipsaw trades."
        )
    if any(w in text for w in ["hello", "hi ", "hey"]):
        return "Hello! I can help with strategies, backtesting, indicators, and risk management. What would you like to know?"
    return (
        "I can discuss trading strategies, backtesting results, technical indicators "
        "(SMA, RSI), and risk management. I'm analytical support only — the strategy rules "
        "you define drive automated execution."
    )


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze/market")
def market_analysis(req: MarketRequest):
    return analyze_market(req.symbol, req.candles)


@app.post("/analyze/strategy")
def strategy_analysis(req: StrategyRequest):
    return analyze_strategy(req.strategy, req.backtestResult)


@app.post("/chat")
def chat(req: ChatRequest):
    return {"reply": chat_reply(req.message, req.context)}
