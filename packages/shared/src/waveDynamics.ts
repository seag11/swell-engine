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
