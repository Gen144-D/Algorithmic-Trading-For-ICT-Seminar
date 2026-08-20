import { useEffect, useState } from 'react';
import api, { fmtMoney } from '../api/client';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ symbol: 'BTC', type: 'price', direction: 'above', value: 0 });

  const load = () => api('/alerts').then(setAlerts).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api('/market/symbols').then((d) => {
      setSymbols(d.symbols);
      setForm((f) => ({ ...f, symbol: d.symbols[0] || 'BTC' }));
    }).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/alerts', {
        method: 'POST',
        body: {
          symbol: form.symbol,
          type: form.type,
          condition: { direction: form.direction, value: Number(form.value) },
        },
      });
      setForm((f) => ({ ...f, value: 0 }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (a) => {
    try {
      await api(`/alerts/${a.id}`, { method: 'PATCH', body: { active: !a.active } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (a) => {
    try {
      await api(`/alerts/${a.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Price Alerts</h1>

      {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}

      <form onSubmit={create} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Symbol</label>
          <select className="input w-32" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input w-32" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="price">Price</option>
            <option value="indicator">Indicator</option>
          </select>
        </div>
        <div>
          <label className="label">Direction</label>
          <select className="input w-28" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
            <option value="above">Price ≥</option>
            <option value="below">Price ≤</option>
          </select>
        </div>
        <div>
          <label className="label">Value</label>
          <input className="input w-32" type="number" step="any" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </div>
        <button className="btn-primary">Create alert</button>
      </form>

      <div className="card">
        <h2 className="font-semibold mb-4">Your alerts ({alerts.length})</h2>
        {alerts.length ? (
          <ul className="divide-y divide-base-800">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-semibold text-slate-200">{a.symbol}</span>
                  <span className="text-sm text-slate-400 ml-2">
                    {a.condition?.direction === 'above' ? '≥' : '≤'} {fmtMoney(a.condition?.value)}
                  </span>
                  <span className={`badge ml-2 ${a.active ? 'bg-emerald-900/50 text-emerald-400' : 'bg-base-700 text-slate-400'}`}>
                    {a.active ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggle(a)} className="btn-ghost text-sm">{a.active ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => remove(a)} className="btn-danger text-sm">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">No alerts yet. Create one to get notified when a price crosses a level.</p>
        )}
      </div>
    </div>
  );
}