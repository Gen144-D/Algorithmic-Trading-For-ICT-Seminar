import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fmtMoney } from '../api/client';
import LineChart from '../components/LineChart';
import StatCard from '../components/StatCard';

export default function Backtest() {
  const [strategies, setStrategies] = useState([]);
  const [strategyId, setStrategyId] = useState('');
  const [capital, setCapital] = useState(10000);
  const [feePct, setFeePct] = useState(0.05);
  const [slippagePct, setSlippagePct] = useState(0.02);
  const [allowShort, setAllowShort] = useState(false);
  const [result, setResult] = useState(null);
  const [optimized, setOptimized] = useState(null);
  const [walk, setWalk] = useState(null);
  const [ai, setAi] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api('/strategies').then((s) => {
      setStrategies(s);
      if (s.length) setStrategyId(s[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  const run = async () => {
    if (!strategyId) return;
    setError('');
    setResult(null);
    setOptimized(null);
    setWalk(null);
    setAi(null);
    setBusy('backtest');
    try {
      const res = await api('/backtest', {
        method: 'POST',
        body: { strategyId, initialCapital: capital, feePct, slippagePct, allowShort },
      });
      setResult(res.result);
      const strategy = strategies.find((s) => s.id === strategyId);
      const analysis = await api('/ai/analyze/strategy', {
        method: 'POST',
        body: { strategy, backtestResult: res.result },
      });
      setAi(analysis);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const runOptimize = async () => {
    if (!strategyId) return;
    setError('');
    setOptimized(null);
    setWalk(null);
    setBusy('optimize');
    try {
      const ind = (strategies.find((s) => s.id === strategyId)?.rules?.indicators) || {};
      const paramSpace = {};
      if (ind.sma_fast) paramSpace.sma_fast = [10, 20, 30];
      if (ind.sma_slow) paramSpace.sma_slow = [50, 75, 100];
      if (ind.ema_fast) paramSpace.ema_fast = [12, 20, 30];
      if (ind.ema_slow) paramSpace.ema_slow = [40, 60, 80];
      if (ind.rsi_period) paramSpace.rsi_period = [7, 14, 21];
      if (ind.macd_slow) paramSpace.macd_slow = [21, 26, 34];
      if (Object.keys(paramSpace).length === 0) {
        throw new Error('No optimization-friendly parameters found in this strategy');
      }
      const res = await api('/backtest/optimize', {
        method: 'POST',
        body: { strategyId, paramSpace, initialCapital: capital, feePct, slippagePct },
      });
      setOptimized(res.results);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const runWalk = async () => {
    if (!strategyId) return;
    setError('');
    setOptimized(null);
    setWalk(null);
    setBusy('walk');
    try {
      const ind = (strategies.find((s) => s.id === strategyId)?.rules?.indicators) || {};
      const paramSpace = {};
      if (ind.sma_fast) paramSpace.sma_fast = [10, 20, 30];
      if (ind.sma_slow) paramSpace.sma_slow = [50, 75, 100];
      if (ind.ema_fast) paramSpace.ema_fast = [12, 20, 30];
      if (ind.ema_slow) paramSpace.ema_slow = [40, 60, 80];
      const res = await api('/backtest/walk-forward', {
        method: 'POST',
        body: { strategyId, paramSpace, initialCapital: capital },
      });
      setWalk(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Backtesting</h1>

      <div className="card flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Strategy</label>
          {strategies.length ? (
            <select className="input" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.symbol} · {s.timeframe})</option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-slate-500 py-2">
              No strategies. <Link to="/strategies/new" className="text-accent">Create one first.</Link>
            </div>
          )}
        </div>
        <div className="w-40">
          <label className="label">Initial Capital</label>
          <input className="input" type="number" min={1000} value={capital} onChange={(e) => setCapital(Number(e.target.value))} />
        </div>
        <div className="w-28">
          <label className="label">Fee %</label>
          <input className="input" type="number" step="0.01" min={0} value={feePct} onChange={(e) => setFeePct(Number(e.target.value))} />
        </div>
        <div className="w-28">
          <label className="label">Slippage %</label>
          <input className="input" type="number" step="0.01" min={0} value={slippagePct} onChange={(e) => setSlippagePct(Number(e.target.value))} />
        </div>
        <div className="pb-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={allowShort} onChange={(e) => setAllowShort(e.target.checked)} className="accent-emerald-500" />
            Allow shorting
          </label>
        </div>
        <button onClick={run} className="btn-primary" disabled={!!busy || !strategyId}>
          {busy === 'backtest' ? 'Running…' : 'Run backtest'}
        </button>
        <button onClick={runOptimize} className="btn-ghost" disabled={!!busy || !strategyId}>
          {busy === 'optimize' ? 'Optimizing…' : 'Optimize'}
        </button>
        <button onClick={runWalk} className="btn-ghost" disabled={!!busy || !strategyId}>
          {busy === 'walk' ? 'Testing…' : 'Walk-forward'}
        </button>
      </div>

      {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Return"
              value={`${result.totalReturnPct > 0 ? '+' : ''}${result.totalReturnPct}%`}
              tone={result.totalReturnPct >= 0 ? 'positive' : 'negative'}
              sub={`${fmtMoney(result.initialCapital)} → ${fmtMoney(result.finalEquity)}`}
            />
            <StatCard label="Trades" value={result.numTrades} sub={`win rate ${result.winRate}%`} />
            <StatCard label="Max Drawdown" value={`${result.maxDrawdown}%`} tone={result.maxDrawdown > 20 ? 'negative' : 'default'} />
            <StatCard
              label="Profit Factor"
              value={result.profitFactor === Infinity ? '∞' : Number(result.profitFactor).toFixed(2)}
              tone={result.profitFactor >= 1.5 ? 'positive' : 'default'}
              sub={`sharpe ${Number(result.sharpe || 0).toFixed(2)}`}
            />
          </div>

          <div className="card">
            <h2 className="font-semibold mb-4">Equity Curve</h2>
            <LineChart
              height={220}
              series={[{ name: 'equity', data: result.equityCurve.map((p) => p.equity), color: '#38bdf8' }]}
            />
          </div>

          {ai && (
            <div className="card">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-semibold">AI Strategy Assessment</h2>
                <span className={`badge ${ai.recommendation === 'ACTIVATE' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-amber-900/50 text-amber-400'}`}>
                  {ai.recommendation}
                </span>
              </div>
              <p className="text-sm text-slate-300 mb-3">{ai.summary}</p>
              <ul className="space-y-1 text-sm text-emerald-400">
                {ai.checks.map((c, i) => <li key={i}>✓ {c}</li>)}
              </ul>
              {ai.issues.length > 0 && (
                <ul className="space-y-1 text-sm text-rose-400 mt-2">
                  {ai.issues.map((c, i) => <li key={i}>✗ {c}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="card">
            <h2 className="font-semibold mb-4">Trade List ({result.trades.length})</h2>
            {result.trades.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-base-700">
                      <th className="table-th">Entered</th>
                      <th className="table-th">Exited</th>
                      <th className="table-th">Entry</th>
                      <th className="table-th">Exit</th>
                      <th className="table-th">Reason</th>
                      <th className="table-th">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(-15).reverse().map((t, i) => (
                      <tr key={i} className="border-b border-base-800">
                        <td className="table-td">{new Date(t.entryTime).toLocaleString()}</td>
                        <td className="table-td">{new Date(t.exitTime).toLocaleString()}</td>
                        <td className="table-td">{fmtMoney(t.entryPrice)}</td>
                        <td className="table-td">{fmtMoney(t.exitPrice)}</td>
                        <td className="table-td"><span className="badge bg-base-700 text-slate-300">{t.reason}</span></td>
                        <td className={`table-td font-semibold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtMoney(t.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-6 text-center">Strategy generated no trades on this data set.</p>
            )}
          </div>
        </>
      )}

      {optimized && (
        <div className="card">
          <h2 className="font-semibold mb-4">Optimization Results (top {optimized.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-base-700">
                  <th className="table-th">Parameters</th>
                  <th className="table-th">Return</th>
                  <th className="table-th">Trades</th>
                  <th className="table-th">Win rate</th>
                  <th className="table-th">Profit factor</th>
                  <th className="table-th">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {optimized.map((r, i) => (
                  <tr key={i} className={`border-b border-base-800 ${i === 0 ? 'bg-emerald-950/30' : ''}`}>
                    <td className="table-td font-mono text-xs text-slate-300">{Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(' ')}</td>
                    <td className={`table-td font-semibold ${r.result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r.result.totalReturnPct > 0 ? '+' : ''}{r.result.totalReturnPct}%
                    </td>
                    <td className="table-td">{r.result.numTrades}</td>
                    <td className="table-td">{r.result.winRate}%</td>
                    <td className="table-td">{r.result.profitFactor === Infinity ? '∞' : Number(r.result.profitFactor).toFixed(2)}</td>
                    <td className="table-td">{r.result.maxDrawdown}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {walk && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="font-semibold mb-3">In-sample (70%)</h2>
            {walk.inSample.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1 text-sm">
                <span className="font-mono text-xs text-slate-400">{Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(' ')}</span>
                <span className="font-semibold">{r.result.totalReturnPct}%</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="font-semibold mb-3">Out-of-sample (30%)</h2>
            {walk.outOfSample.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1 text-sm">
                <span className="font-mono text-xs text-slate-400">{Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(' ')}</span>
                <span className="font-semibold">{r.result.totalReturnPct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
