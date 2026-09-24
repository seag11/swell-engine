/**
 * tide.ts — reconstructing a tide curve from high/low predictions (swellKit)
 */

export type TideExtremeKind = 'H' | 'L';

export interface TideExtreme {
  t: string; // ISO 8601, UTC
  level: number; // metres relative to MLLW
  kind: TideExtremeKind;
}

/**
 * Water level at an instant, interpolated between the bracketing extremes.
 *
 * Tide rises and falls as a half cosine between consecutive turning points —
 * slow at the turn, fastest at mid-tide — which tracks the real curve to within
 * a few centimetres. This is not a cosmetic easing choice: a generic spline
 * through the same points overshoots and invents highs that do not occur.
 *
 * Interpolation is unavoidable rather than an optimisation. NOAA serves a
 * continuous series only for reference stations; subordinate stations — which
 * are often the closest to a given break — publish high/low events only.
 *
 * Returns null when `atMs` falls outside the extremes provided, so callers must
 * supply extremes bracketing the range they intend to draw.
 */
export function tideLevelAt(extremes: TideExtreme[], atMs: number): number | null {
  for (let i = 0; i < extremes.length - 1; i += 1) {
    const from = extremes[i];
    const to = extremes[i + 1];
    const fromMs = Date.parse(from.t);
    const toMs = Date.parse(to.t);
    if (atMs < fromMs || atMs > toMs || toMs === fromMs) continue;

    const progress = (atMs - fromMs) / (toMs - fromMs);
    return from.level + ((to.level - from.level) * (1 - Math.cos(Math.PI * progress))) / 2;
  }
  return null;
}

/** Samples the curve at a fixed cadence, skipping instants outside the extremes. */
export function sampleTideCurve(
  extremes: TideExtreme[],
  fromMs: number,
  toMs: number,
  stepMs: number,
): Array<{ t: number; level: number }> {
  const points: Array<{ t: number; level: number }> = [];
  for (let at = fromMs; at <= toMs; at += stepMs) {
    const level = tideLevelAt(extremes, at);
    if (level !== null) points.push({ t: at, level });
  }
  return points;
}
