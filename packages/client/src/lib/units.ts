export const M_TO_FT = 3.28084;
export const MPS_TO_KNOTS = 1.944;
export const KM_TO_MI = 0.621371;

export type Units = 'metric' | 'imperial';

const WIND_DIRS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

export function compass(deg: number | null): string {
  if (deg === null) return '—';
  return WIND_DIRS[Math.round(deg / 22.5) % 16];
}

/**
 * Surf height as a range, which is the reporting convention: significant
 * height is already the mean of the highest third, so a single figure implies
 * a precision the measurement does not have. Whole feet, because that is how
 * surf is spoken about.
 */
export function fmtSurfRange(
  lowM: number | null,
  highM: number | null,
  units: Units,
): string {
  if (lowM === null) return '—';
  const high = highM ?? lowM;
  if (units === 'imperial') {
    const lo = Math.round(lowM * M_TO_FT);
    const hi = Math.round(high * M_TO_FT);
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  }
  const lo = lowM.toFixed(1);
  const hi = high.toFixed(1);
  return lo === hi ? lo : `${lo}–${hi}`;
}

export const surfUnit = (units: Units) => (units === 'imperial' ? 'ft' : 'm');

export function fmtHeight(m: number | null, units: Units): string {
  if (m === null) return '—';
  return units === 'imperial' ? `${(m * M_TO_FT).toFixed(1)} ft` : `${m.toFixed(2)} m`;
}

export function fmtSpeed(mps: number | null, units: Units): string {
  if (mps === null) return '—';
  return units === 'imperial'
    ? `${(mps * MPS_TO_KNOTS).toFixed(1)} kts`
    : `${mps.toFixed(1)} m/s`;
}

export function fmtTemp(c: number | null, units: Units): string {
  if (c === null) return '—';
  return units === 'imperial' ? `${(c * 9) / 5 + 32}`.slice(0, 4) + ' °F' : `${c.toFixed(1)} °C`;
}

export function fmtDistance(km: number | null, units: Units): string {
  if (km === null) return '—';
  return units === 'imperial' ? `${Math.round(km * KM_TO_MI)} mi` : `${Math.round(km)} km`;
}

export function fmtPeriod(s: number | null): string {
  return s === null ? '—' : `${s.toFixed(1)}`;
}

/**
 * True if the wind blows from the land across the break, which holds a wave
 * face up rather than crumbling it. Both bearings are degrees true, and both
 * describe where the wind or swell comes *from*.
 */
export function isOffshore(windDirection: number | null, facing: number | undefined): boolean {
  if (windDirection === null || facing === undefined) return false;
  return Math.abs(((windDirection - facing + 540) % 360) - 180) < 90;
}
