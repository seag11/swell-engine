/**
 * triangulate.ts — blending buoy observations into a forecast for a point
 */

import type {
  BuoyObservation,
  Forecast,
  ForecastRequest,
  ObservationWeight,
} from './contract.js';
import { computeSwellPower, classifyTone } from './surf.js';

const EARTH_RADIUS_KM = 6371;

/** How many observations the blend expects. Callers select the candidates. */
export const OBSERVATION_LIMIT = 3;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Equirectangular approximation. Cheaper than haversine and accurate to well
 * under a percent at the distances between a break and its nearby buoys.
 */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const x = toRad(lon2 - lon1) * Math.cos(toRad((lat1 + lat2) / 2));
  const y = toRad(lat2 - lat1);
  return EARTH_RADIUS_KM * Math.sqrt(x * x + y * y);
}

function weightedMean(samples: Array<{ value: number | null; weight: number }>): number | null {
  const present = samples.filter((s): s is { value: number; weight: number } => s.value !== null);
  if (present.length === 0) return null;
  const total = present.reduce((sum, s) => sum + s.weight, 0);
  if (total === 0) return null;
  return present.reduce((sum, s) => sum + (s.value * s.weight) / total, 0);
}

/**
 * Inverse-distance weighting, optionally narrowed by which way the break faces.
 *
 * Distance weights go as 1/d² so a buoy twice as far contributes a quarter as
 * much. When `facing` is given, each observation is additionally scaled by the
 * cosine of the angle between its swell direction and the break, clamped at
 * zero — swell arriving from behind the headland is not relevant to this break.
 *
 * If every directional weight clamps to zero there is no relevant swell in the
 * set, and the blend falls back to distance alone rather than returning nothing.
 */
export function triangulate(request: ForecastRequest): Forecast {
  const { target, observations, facing } = request;

  const distances = observations.map((o) => distanceKm(target.lat, target.lon, o.lat, o.lon));
  const byDistance = distances.map((d) => 1 / d ** 2);

  const byDirection = observations.map((o) =>
    facing !== undefined && o.waveDirection !== null
      ? Math.max(0, Math.cos(toRad(o.waveDirection - facing)))
      : 1,
  );

  const combined = byDistance.map((d, i) => d * byDirection[i]);
  const weights = combined.reduce((sum, w) => sum + w, 0) > 0 ? combined : byDistance;
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const field = (key: keyof BuoyObservation) =>
    weightedMean(
      observations.map((o, i) => ({ value: o[key] as number | null, weight: weights[i] })),
    );

  const waveHeight = field('waveHeight');
  const dominantPeriod = field('dominantPeriod');
  const swellPower = computeSwellPower(waveHeight, dominantPeriod);

  // Averaging compass bearings is meaningless across the 0/360 wrap, so wind
  // direction is taken from the single most influential observation instead.
  const dominant = weights.indexOf(Math.max(...weights));

  const observationWeights: ObservationWeight[] = observations.map((o, i) => ({
    stationId: o.stationId,
    distanceKm: Math.round(distances[i]),
    weight: parseFloat((weights[i] / totalWeight).toFixed(3)),
  }));

  const observedAt = new Date(
    Math.min(...observations.map((o) => Date.parse(o.observedAt))),
  ).toISOString();

  return {
    waveHeight,
    dominantPeriod,
    swellPower,
    windSpeed: field('windSpeed'),
    windDirection: observations[dominant]?.windDirection ?? null,
    waterTemp: field('waterTemp'),
    tone: classifyTone(waveHeight, swellPower),
    weights: observationWeights,
    observedAt,
  };
}
