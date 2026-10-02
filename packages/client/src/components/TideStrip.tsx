import { sampleTideCurve } from '@swell-engine/shared';
import { fmtHeight, type Units } from '@/lib/units';
import type { Tide } from '@/lib/api';

const SAMPLE_STEP_MS = 15 * 60_000;
const TICK_STEP_MS = 3 * 60 * 60_000;
const VERTICAL_PADDING = 0.16;

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function TideStrip({ tide, units }: { tide: Tide; units: Units }) {
  const fromMs = Date.parse(tide.window.from);
  const toMs = Date.parse(tide.window.to);
  const nowMs = Date.parse(tide.now.at);

  const points = sampleTideCurve(tide.extremes, fromMs, toMs, SAMPLE_STEP_MS);
  if (points.length < 2) return null;

  const levels = points.map((p) => p.level);
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  const pad = Math.max((hi - lo) * VERTICAL_PADDING, 0.05);
  const floor = lo - pad;
  const ceil = hi + pad;

  // Drawn in a 0–100 box stretched by preserveAspectRatio, so the curve fills
  // any width while non-scaling-stroke keeps the line from distorting with it.
  const x = (ms: number) => ((ms - fromMs) / (toMs - fromMs)) * 100;
  const y = (level: number) => 100 - ((level - floor) / (ceil - floor)) * 100;

  const line = points.map((p) => `${x(p.t).toFixed(2)},${y(p.level).toFixed(2)}`).join(' L');

  const ticks: number[] = [];
  for (let t = fromMs; t <= toMs; t += TICK_STEP_MS) ticks.push(t);

  const visible = tide.extremes
    .map((e) => ({ ...e, ms: Date.parse(e.t) }))
    .filter((e) => e.ms > fromMs && e.ms < toMs);

  const nextLabel = tide.next
    ? `${tide.next.kind === 'H' ? 'high' : 'low'} ${fmtHeight(tide.next.level, units)} at ${fmtTime(
        Date.parse(tide.next.at),
      )}, in ${Math.floor(tide.next.inMinutes / 60)}h ${tide.next.inMinutes % 60}m`
    : null;

  return (
    <section className="border-b border-sw-border dark:border-sw-dark-border">
      <div className="flex items-baseline justify-between gap-3 flex-wrap px-4 pt-3 pb-2 border-b border-sw-rule dark:border-sw-dark-rule">
        <h2 className="font-cond text-[11px] uppercase tracking-[0.14em] font-bold">Tide</h2>
        <p className="font-mono text-[10.5px] text-sw-muted dark:text-sw-dark-muted text-right">
          {fmtHeight(tide.now.level, units)} and {tide.now.trend}
          {nextLabel ? ` · next ${nextLabel}` : ''} · {tide.station.name} ({tide.station.distanceKm}{' '}
          km)
        </p>
      </div>

      <div className="px-4 pt-3 pb-3">
        <div className="relative h-20">
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={`M${line} L100,100 L0,100 Z`} className="fill-sw-blue/12" />
            <path
              d={`M${line}`}
              className="stroke-sw-blue"
              fill="none"
              strokeWidth="1.8"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={x(nowMs).toFixed(2)}
              y1="0"
              x2={x(nowMs).toFixed(2)}
              y2="100"
              className="stroke-sw-strong dark:stroke-sw-dark-strong"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {visible.map((e) => (
            <div
              key={e.t}
              className={`absolute -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tabular-nums ${
                e.kind === 'H'
                  ? 'text-sw-text dark:text-sw-dark-text'
                  : 'text-sw-amber'
              }`}
              style={{
                left: `${x(e.ms)}%`,
                top: `${y(e.level)}%`,
                marginTop: e.kind === 'H' ? -17 : 7,
              }}
            >
              {e.kind === 'H' ? 'HIGH' : 'LOW'} {fmtHeight(e.level, units)} {fmtTime(e.ms)}
            </div>
          ))}
        </div>

        <div className="relative h-3.5 mt-1 font-mono text-[10px] text-sw-muted dark:text-sw-dark-muted tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>
              {fmtTime(t)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
