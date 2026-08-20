import { useEffect, useState } from 'react';
import api, { fmtMoney } from '../api/client';

export default function Journal() {
  const [portfolio, setPortfolio] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [p, n] = await Promise.all([api('/api/portfolio'), api('/journal')]);
      setPortfolio(p);
      setNotes(n);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addNote = async (e) => {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    try {
      await api('/journal', { method: 'POST', body: { tradeId: selected, note: draft } });
      setDraft('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const closed = portfolio?.closedTrades || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trade Journal</h1>

      {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-4">Closed trades</h2>
          {closed.length ? (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {closed.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`w-full text-left flex items-center justify-between p-3 rounded-lg border text-sm ${
                    selected === t.id ? 'border-accent bg-base-900' : 'border-base-700 hover:border-base-600'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-200">{t.symbol} <span className={`text-xs ${t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.side}</span></div>
                    <div className="text-xs text-slate-500">{new Date(t.closed_at || t.updated_at).toLocaleString()}</div>
                  </div>
                  <div className={`font-semibold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtMoney(t.pnl)}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">No closed trades to journal yet.</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-2">{selected ? 'New note' : 'Select a trade to journal'}</h2>
            {selected && (
              <form onSubmit={addNote} className="flex gap-2">
                <input
                  className="input flex-1"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="What happened, what would you do differently?"
                />
                <button className="btn-primary">Add</button>
              </form>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold mb-3">Notes ({notes.length})</h2>
            {notes.length ? (
              <ul className="divide-y divide-base-800">
                {notes.slice().reverse().map((n) => (
                  <li key={n.id} className="py-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Trade {n.trade_id.slice(0, 8)}</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-200 mt-1">{n.note}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No journal entries yet. Capture lessons after each trade.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}