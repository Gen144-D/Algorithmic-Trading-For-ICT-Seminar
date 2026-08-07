import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Strategies() {
  const [strategies, setStrategies] = useState([]);
  const [error, setError] = useState('');

  const load = () => api('/strategies').then(setStrategies).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const toggle = async (s) => {
    try {
      await api(`/strategies/${s.id}/activate`, { method: 'POST', body: { active: !s.active } });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (s) => {
    if (!confirm(`Delete strategy "${s.name}"?`)) return;
    try {
      await api(`/strategies/${s.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Strategies</h1>
        <Link to="/strategies/new" className="btn-primary">+ New strategy</Link>
      </div>

      {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}

      {strategies.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-400">No strategies yet.</p>
          <Link to="/strategies/new" className="btn-primary mt-4 inline-block">Create your first strategy</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {strategies.map((s) => {
            const ind = s.rules?.indicators || {};
            const risk = s.risk || {};
            return (
              <div key={s.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-100">{s.name}</h2>
                    <p className="text-xs text-slate-400">
                      {s.symbol} · {s.timeframe} · SMA {ind.sma_fast}/{ind.sma_slow} · RSI {ind.rsi_period}
                    </p>
                  </div>
                  <span className={`badge ${s.active ? 'bg-emerald-900/50 text-emerald-400' : 'bg-base-700 text-slate-400'}`}>
                    {s.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Risk: SL {risk.stopLossPct || 0}% · TP {risk.takeProfitPct || 0}% · Size {risk.positionSize || 1000} · Max {risk.maxOpenTrades || 3}
                </p>
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => toggle(s)} className={`btn flex-1 text-sm ${s.active ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'}`}>
                    {s.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <Link to={`/strategies/${s.id}/edit`} className="btn-ghost text-sm">Edit</Link>
                  <button onClick={() => remove(s)} className="btn-danger text-sm">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
