import { useEffect, useMemo, useState } from 'react';
import api, { fmtMoney } from '../api/client';
import LineChart from '../components/LineChart';

function smaSeries(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const window = closes.slice(i - period + 1, i + 1);
    return window.reduce((a, b) => a + b, 0) / period;
  });
}

export default function Market() {
  const [symbols, setSymbols] = useState(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'SPY', 'BTC', 'ETH']);
  const [timeframes, setTimeframes] = useState(['1h', '4h', '1d']);
  const [symbol, setSymbol] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1h');
  const [candles, setCandles] = useState([]);
  const [ai, setAi] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/market/symbols').then((d) => {
      setSymbols(d.symbols);
      setTimeframes(d.timeframes);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setAi(null);
    api(`/market/candles?symbol=${symbol}&timeframe=${timeframe}&count=200`)
      .then((d) => setCandles(d.candles))
      .catch(() => setCandles([]))
      .finally(() => setLoading(false));
  }, [symbol, timeframe]);

  const closes = useMemo(() => candles.map((c) => c.close), [candles]);
  const smaFast = useMemo(() => smaSeries(closes, 20), [closes]);
  const smaSlow = useMemo(() => smaSeries(closes, 50), [closes]);
  const last = candles[candles.length - 1];
  const change = last ? ((last.close - last.open) / last.open) * 100 : 0;

  const analyze = async () => {
    setAi(null);
    const data = await api('/ai/analyze/market', {
      method: 'POST',
      body: { symbol, candles: candles.slice(-100) },
    });
    setAi(data);
  };

  const indicators = useMemo(() => {
    if (!candles.length) return null;
    const rsi = (() => {
      const period = 14;
      if (closes.length < period + 1) return null;
      let g = 0, l = 0;
      for (let i = closes.length - period; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        if (d >= 0) g += d; else l -= d;
      }
      if (l === 0) return 100;
      return 100 - 100 / (1 + (g / period) / (l / period));
    })();
    return {
      rsi: rsi == null ? '—' : rsi.toFixed(1),
      smaFast: smaFast[smaFast.length - 1] == null ? '—' : smaFast[smaFast.length - 1].toFixed(2),
      smaSlow: smaSlow[smaSlow.length - 1] == null ? '—' : smaSlow[smaSlow.length - 1].toFixed(2),
      vol: ((closes[closes.length - 1] - closes[closes.length - 11]) / closes[closes.length - 11] * 100).toFixed(2),
    };
  }, [candles, closes, smaFast, smaSlow]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Market</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Symbol</label>
          <select className="input w-32" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Timeframe</label>
          <select className="input w-28" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            {timeframes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400">Last close</div>
          <div className="text-2xl font-bold">{last ? fmtMoney(last.close) : '—'}</div>
          <div className={`text-sm font-medium ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center text-slate-500 py-16">Loading market data…</div>
      ) : (
        <>
          <div className="card">
            <LineChart
              height={280}
              series={[
                { name: symbol, data: closes, color: '#38bdf8' },
                { name: 'SMA 20', data: smaFast, color: '#fbbf24' },
                { name: 'SMA 50', data: smaSlow, color: '#a78bfa' },
              ]}
            />
            <div className="flex gap-4 text-xs text-slate-400 mt-2">
              <span><span className="text-accent">■</span> {symbol}</span>
              <span><span className="text-amber-400">■</span> SMA 20</span>
              <span><span className="text-violet-400">■</span> SMA 50</span>
            </div>
          </div>

          {indicators && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card"><div className="label">RSI (14)</div><div className="text-xl font-bold">{indicators.rsi}</div></div>
              <div className="card"><div className="label">SMA 20</div><div className="text-xl font-bold">{indicators.smaFast}</div></div>
              <div className="card"><div className="label">SMA 50</div><div className="text-xl font-bold">{indicators.smaSlow}</div></div>
              <div className="card"><div className="label">10-bar Momentum</div><div className="text-xl font-bold">{indicators.vol}%</div></div>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">AI Market Analysis</h2>
              <button onClick={analyze} className="btn-ghost text-sm">Analyze {symbol}</button>
            </div>
            {ai ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`badge ${ai.sentiment === 'BULLISH' ? 'bg-emerald-900/50 text-emerald-400' : ai.sentiment === 'BEARISH' ? 'bg-rose-900/50 text-rose-400' : 'bg-base-700 text-slate-300'}`}>
                    {ai.sentiment}
                  </span>
                  <span className="text-sm text-slate-400">score {ai.score}/100</span>
                </div>
                <p className="text-sm text-slate-300">{ai.summary}</p>
                <ul className="space-y-1 text-sm text-slate-400">
                  {ai.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">
                The AI service analyzes RSI, SMA trend and momentum to describe current market conditions.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
