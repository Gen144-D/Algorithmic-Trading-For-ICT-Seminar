import { useEffect, useState } from 'react';
import api, { fmtMoney } from '../api/client';
import StatCard from '../components/StatCard';

export default function Analytics() {
  const [portfolio, setPortfolio] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    Promise.all([api('/api/portfolio'), api('/api/logs')])
      .then(([p, l]) => {
        setPortfolio(p);
        setLogs(l);
      })
      .catch(() => {});
  }, []);

  const closed = portfolio?.closedTrades || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics & Monitoring</h1>

      {portfolio && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Equity" value={fmtMoney(portfolio.equity)} tone="accent" />
          <StatCard label="Realized P/L" value={fmtMoney(portfolio.realizedPnl)} tone={portfolio.realizedPnl >= 0 ? 'positive' : 'negative'} />
          <StatCard label="Unrealized P/L" value={fmtMoney(portfolio.unrealizedPnl)} tone={portfolio.unrealizedPnl >= 0 ? 'positive' : 'negative'} />
          <StatCard label="Closed Trades" value={closed.length} />
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-4">Trade History</h2>
        {closed.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-base-700">
                  <th className="table-th">Symbol</th>
                  <th className="table-th">Side</th>
                  <th className="table-th">Qty</th>
                  <th className="table-th">Entry</th>
                  <th className="table-th">Exit</th>
                  <th className="table-th">Opened</th>
                  <th className="table-th">P/L</th>
                </tr>
              </thead>
              <tbody>
                {closed.slice().reverse().map((t) => (
                  <tr key={t.id} className="border-b border-base-800">
                    <td className="table-td font-semibold text-slate-100">{t.symbol}</td>
                    <td className="table-td"><span className={`badge ${t.side === 'BUY' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'}`}>{t.side}</span></td>
                    <td className="table-td">{Number(t.quantity).toFixed(4)}</td>
                    <td className="table-td">{fmtMoney(t.price)}</td>
                    <td className="table-td">{t.closed_at ? fmtMoney(t.price) : '—'}</td>
                    <td className="table-td text-xs text-slate-500">{new Date(t.opened_at).toLocaleString()}</td>
                    <td className={`table-td font-semibold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtMoney(t.pnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">No closed trades yet. Activate a strategy to generate automated trades.</p>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Activity Logs</h2>
        {logs.length ? (
          <ul className="divide-y divide-base-800">
            {logs.map((log, i) => (
              <li key={log.id || i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-200">{log.action}</span>
                <span className="text-xs text-slate-500">
                  {new Date(log.created_at).toLocaleString()}
                  {log.detail?.price ? ` · ${fmtMoney(log.detail.price)}` : ''}
                  {log.detail?.pnl ? ` · P/L ${fmtMoney(log.detail.pnl)}` : ''}
                  {log.detail?.symbol ? ` · ${log.detail.symbol}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 py-6 text-center">No activity logged yet.</p>
        )}
      </div>
    </div>
  );
}
