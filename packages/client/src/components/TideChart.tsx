import { sampleTideCurve } from '@swell-engine/shared';
import { M_TO_FT } from '@/lib/units';
import type { Tide } from '@/lib/api';

const SAMPLE_STEP_MS = 15 * 60_000;
const TICK_STEP_MS = 3 * 60 * 60_000;
const VERTICAL_PADDING = 0.12;

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtLevel = (m: number) => `${m.toFixed(1)}m / ${(m * M_TO_FT).toFixed(1)}ft`;

export default function TideChart({ tide }: { tide: Tide }) {
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

  // Drawn in a 0-100 box stretched by preserveAspectRatio, so the curve fills any
  // width while non-scaling-stroke keeps the line from distorting with it.
  const x = (ms: number) => ((ms - fromMs) / (toMs - fromMs)) * 100;
  const y = (level: number) => 100 - ((level - floor) / (ceil - floor)) * 100;

  const line = points.map((p) => `${x(p.t).toFixed(2)},${y(p.level).toFixed(2)}`).join(' L');
  const area = `M${line} L100,100 L0,100 Z`;

  const ticks: number[] = [];
  for (let t = fromMs; t <= toMs; t += TICK_STEP_MS) ticks.push(t);

  const visibleExtremes = tide.extremes
    .map((e) => ({ ...e, ms: Date.parse(e.t) }))
    .filter((e) => e.ms > fromMs && e.ms < toMs);

  return (
    <div className="bg-sw-card dark:bg-sw-dark-card rounded-xl p-4">
      <div className="flex justify-between items-baseline gap-3 flex-wrap mb-4">
        <span className="text-sw-muted dark:text-sw-dark-muted text-xs uppercase tracking-wide">
          Tide
        </span>
        {tide.next && (
          <span className="text-sm">
            <span className="font-semibold">
              {tide.next.kind === 'H' ? 'High' : 'Low'} {fmtTime(Date.parse(tide.next.at))}
            </span>
            <span className="text-sw-muted dark:text-sw-dark-muted">
              {' '}
              in {Math.floor(tide.next.inMinutes / 60)}h {tide.next.inMinutes % 60}m
            </span>
          </span>
        )}
      </div>

      <div className="relative h-32">
        <svg
          className="absolute inset-0 w-full h-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={area} className="fill-sw-blue/15" />
          <path
            d={`M${line}`}
            className="stroke-sw-blue"
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          className="absolute top-0 bottom-0 border-l border-dashed border-sw-strong/40 dark:border-sw-dark-strong/40"
          style={{ left: `${x(nowMs)}%` }}
        />

        {visibleExtremes.map((e) => (
          <div
            key={e.t}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-sw-text dark:text-sw-dark-text"
            style={{ left: `${x(e.ms)}%`, top: `${y(e.level)}%`, marginTop: e.kind === 'H' ? -18 : 6 }}
          >
            {e.level.toFixed(1)}m
          </div>
        ))}
      </div>

      <div className="relative h-4 mt-1 text-[10px] text-sw-muted dark:text-sw-dark-muted">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>
            {fmtTime(t)}
          </span>
        ))}
      </div>

      <div className="flex justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-sw-border dark:border-sw-dark-border text-xs">
        <span>
          <span className="text-sw-muted dark:text-sw-dark-muted">Now </span>
          <span className="font-semibold">{fmtLevel(tide.now.level)}</span>
          <span className="text-sw-muted dark:text-sw-dark-muted"> · {tide.now.trend}</span>
        </span>
        <span className="text-sw-muted dark:text-sw-dark-muted">
          {tide.station.name} ({tide.station.distanceKm} km) · {tide.datum}
        </span>
      </div>
    </div>
  );
}
