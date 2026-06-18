/**
 * surf.ts — wave physics and condition classification (swellKit)
 */

/**
 * Wave power index: P ∝ H² × T
 *
 * Derived from P = (ρg²H²T) / 32π — with ρ and g as constants, the relative
 * index reduces to H² × T. Energy density scales as H²; group velocity scales
 * with T, so longer-period swell transports energy faster to the break.
 *
 * Dimensionless — suited for relative comparisons, not absolute power.
 * Example: 2m @ 18s (≈72) carries ~8× the power of 3m @ 4s (≈36).
 */
export function computeSwellPower(
  waveHeight: number | null,
  dominantPeriod: number | null,
): number | null {
  if (waveHeight === null || dominantPeriod === null) return null;
  return waveHeight ** 2 * dominantPeriod;
}

/**
 * Classifies conditions into a surf quality label using height (in ft) as the
 * base, with a one-level upgrade when swellPower exceeds HIGH_POWER_THRESHOLD.
 * The upgrade reflects that long-period ground swell breaks with significantly
 * more force than wind chop at the same height.
 *
 * Thresholds: <1ft flat · 1–3ft small · 3–6ft solid · 6–10ft large · 10ft+ xxl
 * Power upgrade (P > 20): small→solid · solid→large · large→xxl
 */
export type ConditionTone = 'flat' | 'small' | 'solid' | 'large' | 'xxl';

const HIGH_POWER_THRESHOLD = 20;

export function classifyTone(
  waveHeightMeters: number | null,
  swellPower?: number | null,
): ConditionTone {
  if (waveHeightMeters === null) return 'flat';
  const ft = waveHeightMeters * 3.28084;
  if (ft < 1) return 'flat';

  const highPower = swellPower != null && swellPower > HIGH_POWER_THRESHOLD;

  if (ft < 3) return highPower ? 'solid' : 'small';
  if (ft < 6) return highPower ? 'large' : 'solid';
  if (ft < 10) return highPower ? 'xxl' : 'large';
  return 'xxl';
}
