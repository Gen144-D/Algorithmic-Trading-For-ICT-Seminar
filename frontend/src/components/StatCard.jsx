export default function StatCard({ label, value, sub, tone = 'default' }) {
  const tones = {
    default: 'text-slate-200',
    positive: 'text-emerald-400',
    negative: 'text-rose-400',
    accent: 'text-accent',
  };
  return (
    <div className="card">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tones[tone] || tones.default}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
