import { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';

// Candlestick chart with optional SMA overlay lines.
export default function CandleChart({ candles, overlays = [], height = 320 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = createChart(ref.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: '#334155' },
      rightPriceScale: { borderColor: '#334155' },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#34d399',
      downColor: '#fb7185',
      borderUpColor: '#34d399',
      borderDownColor: '#fb7185',
      wickUpColor: '#34d399',
      wickDownColor: '#fb7185',
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: Math.floor(new Date(c.ts).getTime() / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    chart.timeScale().fitContent();

    const lineSeries = overlays.map((ov) => {
      const s = chart.addLineSeries({ color: ov.color, lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
      s.setData(
        candles
          .map((c, i) => ({ time: Math.floor(new Date(c.ts).getTime() / 1000), value: ov.data[i] }))
          .filter((p) => p.value != null && Number.isFinite(p.value))
      );
      return s;
    });

    return () => {
      lineSeries.forEach((s) => chart.removeSeries(s));
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, overlays, height]);

  return <div ref={ref} className="w-full" />;
}