import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';

const DEFAULT = {
  name: '',
  symbol: 'AAPL',
  timeframe: '1h',
  rules: {
    indicators: { sma_fast: 20, sma_slow: 50, rsi_period: 14 },
    buyConditions: [{ type: 'crossover', fast: 'sma_fast', slow: 'sma_slow', indicator: 'sma_fast', value: 30 }],
    sellConditions: [{ type: 'crossunder', fast: 'sma_fast', slow: 'sma_slow', indicator: 'sma_fast', value: 70 }],
  },
  risk: { stopLossPct: 2, takeProfitPct: 5, positionSize: 1000, maxOpenTrades: 3 },
};

const TEMPLATES = {
  'SMA Crossover': {
    name: 'SMA Crossover',
    rules: {
      indicators: { sma_fast: 20, sma_slow: 50, rsi_period: 14 },
      buyConditions: [{ type: 'crossover', fast: 'sma_fast', slow: 'sma_slow', indicator: 'sma_fast', value: 30 }],
      sellConditions: [{ type: 'crossunder', fast: 'sma_fast', slow: 'sma_slow', indicator: 'sma_fast', value: 70 }],
    },
  },
  'Golden Cross + RSI Filter': {
    name: 'Golden Cross + RSI Filter',
    rules: {
      indicators: { sma_fast: 50, sma_slow: 200, rsi_period: 14 },
      buyConditions: [
        { type: 'crossover', fast: 'sma_fast', slow: 'sma_slow', indicator: 'sma_fast', value: 30 },
        { type: 'below', indicator: 'rsi', value: 40 },
      ],
      sellConditions: [
        { type: 'crossunder', fast: 'sma_fast', slow: 'sma_slow', indicator: 'sma_fast', value: 70 },
        { type: 'above', indicator: 'rsi', value: 60 },
      ],
    },
  },
  'RSI Mean Reversion': {
    name: 'RSI Mean Reversion',
    rules: {
      indicators: { sma_fast: 20, sma_slow: 50, rsi_period: 14 },
      buyConditions: [{ type: 'below', indicator: 'rsi', value: 30 }],
      sellConditions: [{ type: 'above', indicator: 'rsi', value: 70 }],
    },
  },
};

const INDICATORS = ['sma_fast', 'sma_slow', 'rsi'];

function ConditionRow({ cond, onChange, onRemove, label }) {
  return (
    <div className="flex flex-wrap items-center gap-2 bg-base-900 rounded-lg p-2">
      <select className="input w-36" value={cond.type} onChange={(e) => onChange({ ...cond, type: e.target.value })}>
        <option value="crossover">crossover</option>
        <option value="crossunder">crossunder</option>
        <option value="above">above</option>
        <option value="below">below</option>
      </select>

      {(cond.type === 'crossover' || cond.type === 'crossunder') ? (
        <>
          <select className="input w-28" value={cond.fast} onChange={(e) => onChange({ ...cond, fast: e.target.value })}>
            {INDICATORS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <span className="text-xs text-slate-400">vs</span>
          <select className="input w-28" value={cond.slow} onChange={(e) => onChange({ ...cond, slow: e.target.value })}>
            {INDICATORS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </>
      ) : (
        <>
          <select className="input w-28" value={cond.indicator} onChange={(e) => onChange({ ...cond, indicator: e.target.value })}>
            {INDICATORS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <input
            className="input w-24"
            type="number"
            value={cond.value}
            onChange={(e) => onChange({ ...cond, value: Number(e.target.value) })}
          />
        </>
      )}
      <span className="text-xs text-slate-500 hidden lg:inline">{label}</span>
      <button type="button" onClick={onRemove} className="btn-danger text-xs ml-auto">×</button>
    </div>
  );
}

export default function StrategyBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState(DEFAULT);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) {
      api(`/strategies/${id}`).then((s) => {
        setForm({
          name: s.name, symbol: s.symbol, timeframe: s.timeframe,
          rules: s.rules, risk: s.risk,
        });
      }).catch((e) => setError(e.message));
    }
  }, [id]);

  const applyTemplate = (key) => {
    const t = TEMPLATES[key];
    setForm((f) => ({ ...f, name: t.name, rules: JSON.parse(JSON.stringify(t.rules)) }));
  };

  const setRules = (patch) => setForm((f) => ({ ...f, rules: { ...f.rules, ...patch } }));

  const setBuy = (i, cond) => {
    const buyConditions = form.rules.buyConditions.map((c, idx) => (idx === i ? cond : c));
    setRules({ buyConditions });
  };
  const setSell = (i, cond) => {
    const sellConditions = form.rules.sellConditions.map((c, idx) => (idx === i ? cond : c));
    setRules({ sellConditions });
  };
  const cleanConditions = (list) =>
    list.map((c) =>
      c.type === 'crossover' || c.type === 'crossunder'
        ? { type: c.type, fast: c.fast, slow: c.slow }
        : { type: c.type, indicator: c.indicator, value: c.value }
    );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const payload = {
      name: form.name,
      symbol: form.symbol,
      timeframe: form.timeframe,
      rules: {
        indicators: form.rules.indicators,
        buyConditions: cleanConditions(form.rules.buyConditions),
        sellConditions: cleanConditions(form.rules.sellConditions),
      },
      risk: form.risk,
    };
    try {
      if (editing) await api(`/strategies/${id}`, { method: 'PUT', body: payload });
      else await api('/strategies', { method: 'POST', body: payload });
      navigate('/strategies');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{editing ? 'Edit Strategy' : 'Create Strategy'}</h1>
        <button onClick={() => navigate('/strategies')} className="btn-ghost text-sm">Cancel</button>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Templates</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(TEMPLATES).map((k) => (
            <button key={k} onClick={() => applyTemplate(k)} className="btn-ghost text-sm">{k}</button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-6">
        {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Symbol</label>
            <select className="input" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}>
              {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'SPY', 'BTC', 'ETH'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Timeframe</label>
            <select className="input" value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })}>
              {['1m', '5m', '15m', '1h', '4h', '1d'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Indicators</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">SMA Fast</label>
              <input className="input" type="number" min={2} value={form.rules.indicators.sma_fast}
                onChange={(e) => setRules({ indicators: { ...form.rules.indicators, sma_fast: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="label">SMA Slow</label>
              <input className="input" type="number" min={5} value={form.rules.indicators.sma_slow}
                onChange={(e) => setRules({ indicators: { ...form.rules.indicators, sma_slow: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="label">RSI Period</label>
              <input className="input" type="number" min={2} value={form.rules.indicators.rsi_period}
                onChange={(e) => setRules({ indicators: { ...form.rules.indicators, rsi_period: Number(e.target.value) } })} />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Buy conditions <span className="text-xs text-slate-500">(all must be true)</span></h3>
            <button type="button" className="btn-ghost text-xs"
              onClick={() => setRules({ buyConditions: [...form.rules.buyConditions, { type: 'above', indicator: 'rsi', value: 30 }] })}>
              + Add condition
            </button>
          </div>
          <div className="space-y-2">
            {form.rules.buyConditions.map((c, i) => (
              <ConditionRow key={i} cond={c} label={`buy #${i + 1}`}
                onChange={(nc) => setBuy(i, nc)}
                onRemove={() => setRules({ buyConditions: form.rules.buyConditions.filter((_, x) => x !== i) })} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Sell conditions <span className="text-xs text-slate-500">(all must be true)</span></h3>
            <button type="button" className="btn-ghost text-xs"
              onClick={() => setRules({ sellConditions: [...form.rules.sellConditions, { type: 'above', indicator: 'rsi', value: 70 }] })}>
              + Add condition
            </button>
          </div>
          <div className="space-y-2">
            {form.rules.sellConditions.map((c, i) => (
              <ConditionRow key={i} cond={c} label={`sell #${i + 1}`}
                onChange={(nc) => setSell(i, nc)}
                onRemove={() => setRules({ sellConditions: form.rules.sellConditions.filter((_, x) => x !== i) })} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Risk Management</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Stop Loss %</label>
              <input className="input" type="number" step="0.1" min={0} value={form.risk.stopLossPct}
                onChange={(e) => setForm({ ...form, risk: { ...form.risk, stopLossPct: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="label">Take Profit %</label>
              <input className="input" type="number" step="0.1" min={0} value={form.risk.takeProfitPct}
                onChange={(e) => setForm({ ...form, risk: { ...form.risk, takeProfitPct: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="label">Position Size $</label>
              <input className="input" type="number" min={1} value={form.risk.positionSize}
                onChange={(e) => setForm({ ...form, risk: { ...form.risk, positionSize: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="label">Max Open Trades</label>
              <input className="input" type="number" min={1} value={form.risk.maxOpenTrades}
                onChange={(e) => setForm({ ...form, risk: { ...form.risk, maxOpenTrades: Number(e.target.value) } })} />
            </div>
          </div>
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create strategy'}
        </button>
      </form>
    </div>
  );
}
