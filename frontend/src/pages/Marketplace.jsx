import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Marketplace() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => api('/marketplace').then(setItems).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const install = async (item) => {
    setBusyId(item.id);
    try {
      await api(`/marketplace/${item.id}/install`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bot Marketplace</h1>
        <Link to="/strategies/new" className="btn-ghost text-sm">Publish your own →</Link>
      </div>

      {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        {items.map((item) => {
          const ind = item.rules?.indicators || {};
          return (
            <div key={item.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-slate-100">{item.name}</h2>
                  <p className="text-xs text-slate-400">{item.symbol} · {item.timeframe}</p>
                </div>
                <span className="badge bg-emerald-900/50 text-emerald-400">FREE</span>
              </div>
              <p className="text-sm text-slate-400">{item.description}</p>
              <p className="text-xs text-slate-500">
                Indicators: {Object.keys(ind).join(', ') || 'none'}
              </p>
              <div className="mt-auto">
                {item.installed ? (
                  <span className="btn w-full text-sm bg-base-800 text-slate-400 cursor-default">Installed</span>
                ) : (
                  <button onClick={() => install(item)} className="btn-primary w-full" disabled={busyId === item.id}>
                    {busyId === item.id ? 'Installing…' : 'Install to My Strategies'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-slate-400">The marketplace is being seeded. Check back shortly.</p>
        </div>
      )}
    </div>
  );
}