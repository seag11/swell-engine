import type { ConditionSource } from '@/lib/api';

/**
 * Plan view of the buoys behind a reading.
 *
 * The point of this panel is that the model shows its work. Every other surf
 * service reports a number; this one names which stations produced it, how far
 * away they are, and how much each one counted. Line weight carries the
 * contribution, so a station at 1% is visibly almost irrelevant.
 */

const CENTRE = 160;
const MAX_RADIUS = 118;
// Radius is square-rooted so a station at 228km still fits beside one at 28km
// without the near one collapsing into the middle.
const RING_KM = [25, 50, 100, 250];
const SCALE_MAX_KM = 250;

const toRad = (deg: number) => (deg * Math.PI) / 180;

function radiusFor(km: number): number {
  return MAX_RADIUS * Math.sqrt(Math.min(km, SCALE_MAX_KM) / SCALE_MAX_KM);
}

function point(bearingDeg: number, radius: number): [number, number] {
  const a = toRad(bearingDeg);
  return [CENTRE + radius * Math.sin(a), CENTRE - radius * Math.cos(a)];
}

/** Bearing from the break to a station, degrees true. */
export function bearingTo(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): number {
  const dy = to.lat - from.lat;
  const dx = (to.lon - from.lon) * Math.cos(toRad((from.lat + to.lat) / 2));
  return (((Math.atan2(dx, dy) * 180) / Math.PI) + 360) % 360;
}

export default function TriangulationPlan({
  target,
  sources,
  facing,
}: {
  target: { lat: number; lon: number };
  sources: ConditionSource[];
  facing?: number;
}) {
  const [fx, fy] = facing !== undefined ? point(facing, MAX_RADIUS + 8) : [0, 0];
  const [w1x, w1y] = facing !== undefined ? point(facing - 90, MAX_RADIUS + 8) : [0, 0];
  const [w2x, w2y] = facing !== undefined ? point(facing + 90, MAX_RADIUS + 8) : [0, 0];

  return (
    <svg
      viewBox="0 0 320 352"
      className="block w-full h-auto max-w-full"
      role="img"
      aria-label={`Plan view of ${sources.length} contributing buoys around the break`}
    >
      {/* The half-plane the break can receive swell from, where
          cos(direction − facing) stays positive. */}
      {facing !== undefined && (
        <>
          <path
            d={`M${CENTRE},${CENTRE} L${w1x.toFixed(1)},${w1y.toFixed(1)} A${MAX_RADIUS + 8},${
              MAX_RADIUS + 8
            } 0 0 0 ${w2x.toFixed(1)},${w2y.toFixed(1)} Z`}
            className="fill-sw-blue"
            opacity="0.07"
          />
          <line
            x1={CENTRE}
            y1={CENTRE}
            x2={fx.toFixed(1)}
            y2={fy.toFixed(1)}
            className="stroke-sw-blue"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.8"
          />
          <text
            x={fx.toFixed(1)}
            y={(fy - 7).toFixed(1)}
            className="fill-sw-blue font-mono"
            fontSize="8.5"
            textAnchor="middle"
          >
            {facing}° FACE
          </text>
        </>
      )}

      {RING_KM.map((km) => {
        const r = radiusFor(km);
        return (
          <g key={km}>
            <circle
              cx={CENTRE}
              cy={CENTRE}
              r={r.toFixed(1)}
              fill="none"
              className="stroke-sw-rule dark:stroke-sw-dark-rule"
              strokeWidth="1"
            />
            <text
              x={CENTRE}
              y={(CENTRE - r - 3).toFixed(1)}
              className="fill-sw-muted dark:fill-sw-dark-muted font-mono"
              fontSize="8"
              textAnchor="middle"
            >
              {km}
            </text>
          </g>
        );
      })}

      {sources.map((s) => {
        const [x, y] = point(bearingTo(target, s), radiusFor(s.distanceKm));
        const below = y > CENTRE;
        return (
          <g key={s.stationId}>
            <line
              x1={CENTRE}
              y1={CENTRE}
              x2={x.toFixed(1)}
              y2={y.toFixed(1)}
              className="stroke-sw-blue"
              strokeWidth={(0.9 + s.weight * 7).toFixed(2)}
              opacity={(0.35 + s.weight * 0.6).toFixed(2)}
            />
            <circle
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r="3.6"
              className="fill-sw-bg dark:fill-sw-dark-bg stroke-sw-strong dark:stroke-sw-dark-strong"
              strokeWidth="1.4"
            />
            <text
              x={x.toFixed(1)}
              y={(y + (below ? 15 : -9)).toFixed(1)}
              className="fill-sw-text dark:fill-sw-dark-text font-mono"
              fontSize="9.5"
              textAnchor="middle"
            >
              {s.stationId}
            </text>
          </g>
        );
      })}

      <circle cx={CENTRE} cy={CENTRE} r="4.4" className="fill-sw-amber" />
      <text
        x={CENTRE}
        y={CENTRE + 17}
        className="fill-sw-strong dark:fill-sw-dark-strong font-cond"
        fontSize="9.5"
        fontWeight="600"
        letterSpacing="0.08em"
        textAnchor="middle"
      >
        BREAK
      </text>
      <text
        x={CENTRE}
        y={CENTRE + 28}
        className="fill-sw-muted dark:fill-sw-dark-muted font-mono"
        fontSize="8"
        textAnchor="middle"
      >
        km rings
      </text>
    </svg>
  );
}
