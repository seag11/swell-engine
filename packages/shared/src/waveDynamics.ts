/**
 * Wave Power Index
 *
 * In linear wave theory, wave power (energy flux per unit crest width) in deep
 * water is:
 *
 *   P = (ρg²H²T) / 32π
 *
 * where ρ is seawater density (~1025 kg/m³), g is gravitational acceleration
 * (9.81 m/s²), H is significant wave height (metres), and T is dominant period
 * (seconds).
 *
 * Because ρ and g are physical constants, the relative power index reduces to:
 *
 *   P ∝ H² × T
 *
 * This captures two effects:
 *   1. Energy density scales as H² — doubling height quadruples stored energy.
 *   2. Group velocity in deep water = gT/4π, so longer-period swell transports
 *      its energy faster, delivering more joules per second to a breaking wave.
 *
 * Example: a 2m swell at 18s (index ≈ 72) carries ~8× the power of a 3m swell
 * at 4s (index ≈ 36), despite the lower height — consistent with the felt
 * difference between ground swell and wind chop at the break.
 *
 * The index is dimensionless (constants dropped) and suited for relative
 * comparisons between readings, not absolute power calculations.
 */
export function computeSwellPower(
  waveHeight: number | null,
  dominantPeriod: number | null,
): number | null {
  if (waveHeight === null || dominantPeriod === null) return null;
  return waveHeight ** 2 * dominantPeriod;
}

/**
 * Condition Tone Classifier
 *
 * Maps triangulated wave conditions to a human-readable surf quality label.
 * NDBC reports significant wave height in metres; thresholds are expressed in
 * feet to match the conventions used by surfers and forecasting services.
 *
 * Base thresholds (height only):
 *   < 1 ft  → flat
 *   1–3 ft  → small
 *   3–6 ft  → solid
 *   6–10 ft → large
 *   10+ ft  → xxl
 *
 * Swell power upgrade:
 *   When swellPower (H² × T) exceeds HIGH_POWER_THRESHOLD, the tone is bumped
 *   one level upward. This reflects the physical reality that long-period ground
 *   swell delivers significantly more energy per wave than wind chop of the same
 *   height — a 4 ft swell at 18s breaks with the force of a much larger
 *   short-period wave and should be rated accordingly.
 *
 *   Threshold P > 20 captures meaningful ground swell (e.g. 1.5m @ 9s,
 *   1m @ 14s) while leaving short-period wind chop unaffected.
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
