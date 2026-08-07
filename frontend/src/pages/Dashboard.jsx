import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fmtMoney, fmtPct } from '../api/client';
import useWebSocket from '../hooks/useWebSocket';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [signals, setSignals] = useState([]);
  const [logs, setLogs] = useState([]);

  const load = async () => {
    const [p, s, l] = await Promise.all([api('/api/portfolio'), api('/strategies'), api('/api/logs')]);
    setPortfolio(p);
    setStrategies(s);
    setLogs(l);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  useWebSocket((msg) => {
    if (msg.type === 'QUOTES') setQuotes(msg.quotes);
    if (msg.type === 'SIGNAL') {
      setSignals((prev) => [msg, ...prev].slice(0, 8));
      load().catch(() => {});
    }
  });

  const activeCount = strategies.filter((s) => s.active).length;
  const liveSignals = signals.filter((s) => s.signal === 'BUY' || s.signal === 'SELL');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className={`badge ${portfolio ? 'bg-emerald-900/50 text-emerald-400' : 'bg-base-700 text-slate-400'}`}>
          {portfolio ? '● Live feed' : 'connecting…'}
        </span>
      </div>

      {/* live quotes ticker */}
      {quotes.length > 0 && (
        <div className="bg-base-800 rounded-xl border border-base-700 p-3 flex gap-4 overflow-x-auto text-sm">
          {quotes.map((q) => (
            <div key={q.symbol} className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-semibold text-slate-200">{q.symbol}</span>
              <span>{fmtMoney(q.price)}</span>
              <span className={q.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {fmtPct(q.change)}
              </span>
            </div>
          ))}
        </div>
      )}

      {portfolio && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Cash Balance" value={fmtMoney(portfolio.balance)} tone="accent" />
          <StatCard label="Total Equity" value={fmtMoney(portfolio.equity)} />
          <StatCard
            label="Unrealized P/L"
            value={fmtMoney(portfolio.unrealizedPnl)}
            tone={portfolio.unrealizedPnl >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label="Realized P/L"
            value={fmtMoney(portfolio.realizedPnl)}
            tone={portfolio.realizedPnl >= 0 ? 'positive' : 'negative'}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Open Positions</h2>
            <Link to="/market" className="text-sm text-accent">View market →</Link>
          </div>
          {portfolio?.positions?.length ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-base-700">
                  <th className="table-th">Symbol</th>
                  <th className="table-th">Strategy</th>
                  <th className="table-th">Qty</th>
                  <th className="table-th">Entry</th>
                  <th className="table-th">Now</th>
                  <th className="table-th">P/L</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((p) => (
                  <tr key={p.id} className="border-b border-base-800">
                    <td className="table-td font-semibold text-slate-100">{p.symbol}</td>
                    <td className="table-td">{p.strategy_id ? 'Automated' : 'Manual'}</td>
                    <td className="table-td">{Number(p.quantity).toFixed(4)}</td>
                    <td className="table-td">{fmtMoney(p.price)}</td>
                    <td className="table-td">{fmtMoney(p.currentPrice)}</td>
                    <td className={`table-td font-semibold ${p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmtMoney(p.unrealizedPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">
              No open positions. Create and activate a strategy to start automated trading.
            </p>
          )}
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Live Signals</h2>
            {liveSignals.length ? (
              <ul className="space-y-2">
                {liveSignals.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-sm bg-base-900 rounded-lg px-3 py-2">
                    <span className={`font-semibold ${s.signal === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {s.signal === 'BUY' ? '▲ BUY' : '▼ SELL'}
                    </span>
                    <span className="text-slate-300">{s.symbol} · {s.strategy}</span>
                    <span className="text-slate-400">{fmtMoney(s.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Waiting for engine signals…</p>
            )}
          </div>
          <div className="border-t border-base-700 pt-4">
            <h2 className="font-semibold mb-2">Automated Strategies</h2>
            <p className="text-sm text-slate-400">{activeCount} of {strategies.length} active</p>
            <Link to="/strategies" className="btn-ghost mt-3 w-full text-center text-sm">Manage strategies</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Recent Activity</h2>
        {logs.length ? (
          <ul className="divide-y divide-base-800">
            {logs.slice(0, 10).map((log, i) => (
              <li key={log.id || i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-200">{log.action}</span>
                <span className="text-slate-500 text-xs">
                  {new Date(log.created_at).toLocaleString()} · {log.detail?.symbol || log.detail?.name || ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No activity yet.</p>
        )}
      </div>
    </div>
  );
}
