// Lightweight dependency-free SVG line chart.
// props.series: [{ name, data, color }]  data = array of numbers
export default function LineChart({ series, height = 240, valueFormat = (v) => v }) {
  const data = series.flatMap((s) => s.data).filter((v) => v != null);
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-slate-500" style={{ height }}>
        No data
      </div>
    );
  }

  const W = 720;
  const H = height;
  const PAD = 8;
  let min = Math.min(...data);
  let max = Math.max(...data);
  const range = max - min || 1;
  min -= range * 0.05;
  max += range * 0.05;

  const n = series.reduce((m, s) => Math.max(m, s.data.length), 0);
  const x = (i) => PAD + (i / Math.max(n - 1, 1)) * (W - PAD * 2);
  const y = (v) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);

  const grid = [];
  for (let g = 0; g <= 4; g++) {
    const gy = y(min + (g / 4) * (max - min));
    grid.push(
      <line key={g} x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="#1e293b" strokeDasharray="4 4" />
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      {grid}
      {series.map((s) => {
        const pts = s.data
          .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
          .filter(Boolean)
          .join(' ');
        return (
          <polyline
            key={s.name}
            points={pts}
            fill="none"
            stroke={s.color || '#38bdf8'}
            strokeWidth={1.75}
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
