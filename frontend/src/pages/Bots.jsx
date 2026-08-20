import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { fmtMoney } from '../api/client';
import StatCard from '../components/StatCard';

const STATUS_TONE = {
  RUNNING: 'bg-emerald-900/50 text-emerald-400',
  PAUSED: 'bg-amber-900/50 text-amber-400',
  DRAFT: 'bg-base-700 text-slate-300',
  READY: 'bg-sky-900/50 text-sky-400',
  STOPPED: 'bg-rose-900/50 text-rose-400',
  ERROR: 'bg-rose-900/50 text-rose-400',
};

export default function Bots() {
  const [bots, setBots] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = () => api('/bots').then((b) => {
    setBots(b);
    if (b.length) setSelected((prev) => (prev && b.find((x) => x.id === prev.id) ? prev : b[0]));
  }).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const act = async (bot, action) => {
    try {
      await api(`/bots/${bot.id}/${action}`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (bot) => {
    if (!confirm(`Delete bot "${bot.name}"?`)) return;
    try {
      await api(`/bots/${bot.id}`, { method: 'DELETE' });
      if (selected?.id === bot.id) setSelected(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trading Bots</h1>
        <Link to="/strategies" className="btn-primary">+ Bot from strategy</Link>
      </div>

      {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}

      {bots.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-400">No bots yet. Create a strategy and activate it to auto-deploy a bot.</p>
          <Link to="/strategies/new" className="btn-primary mt-4 inline-block">Create a strategy</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            {bots.map((b) => (
              <div key={b.id} className={`card flex flex-col gap-3 cursor-pointer ${selected?.id === b.id ? 'ring-2 ring-accent' : ''}`} onClick={() => setSelected(b)}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-100">{b.name}</h2>
                    <p className="text-xs text-slate-400">{b.strategy?.symbol} · {b.strategy?.timeframe} · {b.mode}</p>
                  </div>
                  <span className={`badge ${STATUS_TONE[b.status] || 'bg-base-700 text-slate-300'}`}>{b.status}</span>
                </div>
                <div className="flex gap-2 mt-auto">
                  {b.status !== 'RUNNING' && b.status !== 'PAUSED' && (
                    <button onClick={(e) => { e.stopPropagation(); act(b, 'start'); }} className="btn flex-1 text-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30">Start</button>
                  )}
                  {b.status === 'RUNNING' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); act(b, 'pause'); }} className="btn flex-1 text-sm bg-amber-600/20 text-amber-400 hover:bg-amber-600/30">Pause</button>
                      <button onClick={(e) => { e.stopPropagation(); act(b, 'stop'); }} className="btn flex-1 text-sm bg-rose-600/20 text-rose-400 hover:bg-rose-600/30">Stop</button>
                    </>
                  )}
                  {b.status === 'PAUSED' && (
                    <button onClick={(e) => { e.stopPropagation(); act(b, 'resume'); }} className="btn flex-1 text-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30">Resume</button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); remove(b); }} className="btn-danger text-sm">Delete</button>
                </div>
              </div>
            ))}
          </div>

          {selected && <BotPerformance bot={selected} />}
        </div>
      )}
    </div>
  );
}

function BotPerformance({ bot }) {
  const [perf, setPerf] = useState(null);
  useEffect(() => {
    api(`/bots/${bot.id}/performance`).then(setPerf).catch(() => {});
  }, [bot.id]);

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold">{bot.name}</h2>
        <p className="text-xs text-slate-400">Performance</p>
      </div>
      {perf ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Realized P/L" value={fmtMoney(perf.realizedPnl)} tone={perf.realizedPnl >= 0 ? 'positive' : 'negative'} />
            <StatCard label="Win rate" value={`${perf.winRate}%`} />
          </div>
          <div className="text-xs text-slate-400">
            {perf.totalTrades} total · {perf.openTrades} open · {perf.closedTrades} closed
          </div>
          {perf.trades.length ? (
            <ul className="divide-y divide-base-800">
              {perf.trades.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-slate-200">{t.symbol}</span>
                  <span className={`font-semibold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtMoney(t.pnl)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No closed trades yet.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading…</p>
      )}
    </div>
  );
}