import { useEffect, useState } from 'react';
import api from '../api/client';

const BROKERS = [
  { value: 'alpaca', label: 'Alpaca' },
  { value: 'paper', label: 'Paper (built-in)' },
];

export default function Brokers() {
  const [conns, setConns] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ broker: 'alpaca', label: '', mode: 'paper', apiKey: '', secretKey: '' });
  const [testing, setTesting] = useState(null);

  const load = () => api('/brokers').then(setConns).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/brokers', {
        method: 'POST',
        body: {
          broker: form.broker,
          label: form.label || form.broker,
          mode: form.mode,
          permissions: { read: true, trade: true, marketData: true },
          credentials: form.broker === 'alpaca' && form.apiKey ? { apiKey: form.apiKey, secretKey: form.secretKey } : undefined,
        },
      });
      setForm({ broker: 'alpaca', label: '', mode: 'paper', apiKey: '', secretKey: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const test = async (conn) => {
    setTesting(conn.id);
    try {
      await api(`/brokers/${conn.id}/test`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(null);
    }
  };

  const toggleLive = async (conn) => {
    try {
      await api(`/brokers/${conn.id}`, { method: 'PATCH', body: { live_enabled: !conn.live_enabled } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (conn) => {
    if (!confirm(`Remove broker connection "${conn.label}"?`)) return;
    try {
      await api(`/brokers/${conn.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Broker Connections</h1>

      {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card space-y-4">
          <h2 className="font-semibold">Add connection</h2>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="label">Broker</label>
              <select className="input" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })}>
                {BROKERS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Label</label>
              <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Alpaca Paper" />
            </div>
            <div>
              <label className="label">Mode</label>
              <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="paper">Paper</option>
                <option value="live">Live</option>
              </select>
            </div>
            {form.broker === 'alpaca' && (
              <>
                <div>
                  <label className="label">API Key</label>
                  <input className="input" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="PK…" />
                </div>
                <div>
                  <label className="label">Secret Key</label>
                  <input className="input" type="password" value={form.secretKey} onChange={(e) => setForm({ ...form, secretKey: e.target.value })} placeholder="SK…" />
                </div>
              </>
            )}
            <button className="btn-primary w-full">Save connection</button>
          </form>
          <p className="text-xs text-slate-500">
            Credentials are encrypted at rest (AES-256-GCM). Live mode requires valid credentials and a passed connectivity test.
          </p>
        </div>

        <div className="space-y-3">
          {conns.length === 0 && (
            <div className="card text-center py-12">
              <p className="text-slate-400">No broker connections yet.</p>
              <p className="text-sm text-slate-500 mt-1">The built-in paper broker is always available for backtesting and simulation.</p>
            </div>
          )}
          {conns.map((c) => (
            <div key={c.id} className="card flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100">{c.label}</span>
                  <span className="badge bg-base-700 text-slate-300">{c.broker}</span>
                  <span className={`badge ${c.mode === 'live' ? 'bg-amber-900/50 text-amber-400' : 'bg-sky-900/50 text-sky-400'}`}>{c.mode}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  status: {c.status}
                  {c.live_enabled ? ' · live enabled' : ' · live disabled (kill-switch on)'}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => test(c)} className="btn-ghost text-sm" disabled={testing === c.id}>
                  {testing === c.id ? 'Testing…' : 'Test'}
                </button>
                <button onClick={() => toggleLive(c)} className={`btn text-sm ${c.live_enabled ? 'bg-amber-600/20 text-amber-400' : 'bg-emerald-600/20 text-emerald-400'}`}>
                  {c.live_enabled ? 'Disable live' : 'Enable live'}
                </button>
                <button onClick={() => remove(c)} className="btn-danger text-sm">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}