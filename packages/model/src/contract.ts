/**
 * contract.ts — the model's input and output boundary.
 *
 * This is deliberately serialisable: plain numbers, strings and nulls, no Date
 * objects and no types borrowed from the application. The model is intended to
 * be replaceable by an out-of-process implementation reached over JSON, so
 * anything that cannot survive that round trip does not belong here.
 *
 * Nothing in this package imports from @swell-engine/shared. The duplication of
 * a few field names is the price of keeping the model portable.
 */

export type ConditionTone = 'flat' | 'small' | 'solid' | 'large' | 'xxl';

/** One buoy's observation, with the position needed to weight it. */
export interface BuoyObservation {
  stationId: string;
  lat: number;
  lon: number;
  observedAt: string; // ISO 8601, UTC
  waveHeight: number | null; // metres
  dominantPeriod: number | null; // seconds
  avgPeriod: number | null; // seconds
  waveDirection: number | null; // degrees true, whence the swell comes
  windSpeed: number | null; // m/s
  windDirection: number | null; // degrees true
  waterTemp: number | null; // °C
}

export interface ForecastRequest {
  target: { lat: number; lon: number };
  observations: BuoyObservation[];
  /** Degrees true the break faces. Omitted means no directional weighting. */
  facing?: number;
}

/** How much each observation contributed, for auditing a forecast. */
export interface ObservationWeight {
  stationId: string;
  distanceKm: number;
  weight: number; // normalised, sums to 1 across the set
}

export interface Forecast {
  waveHeight: number | null; // metres
  dominantPeriod: number | null; // seconds
  swellPower: number | null; // dimensionless index
  windSpeed: number | null; // m/s
  windDirection: number | null; // degrees true
  waterTemp: number | null; // °C
  tone: ConditionTone;
  weights: ObservationWeight[];
  /** Earliest observation in the set — the forecast is only as fresh as this. */
  observedAt: string; // ISO 8601, UTC
}
