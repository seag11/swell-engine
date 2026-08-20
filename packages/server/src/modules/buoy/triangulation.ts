import type { BuoyStation, BuoyReading, TriangulatedConditions } from '@swell-engine/shared';
import { computeSwellPower } from '@swell-engine/shared';

const EARTH_RADIUS_KM = 6371;

function equirectangularKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = EARTH_RADIUS_KM;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x = toRad(lon2 - lon1) * Math.cos(toRad((lat1 + lat2) / 2));
  const y = toRad(lat2 - lat1);
  return R * Math.sqrt(x * x + y * y);
}

function idwAvg(values: Array<{ val: number | null; weight: number }>): number | null {
  const valid = values.filter((v): v is { val: number; weight: number } => v.val !== null);
  if (valid.length === 0) return null;
  const total = valid.reduce((s, v) => s + v.weight, 0);
  return valid.reduce((s, v) => s + (v.val * v.weight) / total, 0);
}

export function triangulate(
  target: { lat: number; lon: number },
  buoys: Array<{ station: BuoyStation & { distanceKm: number }; reading: BuoyReading }>,
  facing?: number,
): TriangulatedConditions {
  const toRad = (d: number) => (d * Math.PI) / 180;

  const entries = buoys.map((b) => ({
    ...b,
    distanceKm: equirectangularKm(target.lat, target.lon, b.station.lat, b.station.lon),
  }));

  const distanceWeights = entries.map((b) => 1 / b.distanceKm ** 2);

  const directionalWeights = entries.map((b) =>
    facing !== undefined && b.reading.waveDirection !== null
      ? Math.max(0, Math.cos(toRad(b.reading.waveDirection - facing)))
      : 1
  );

  const combined = distanceWeights.map((dw, i) => dw * directionalWeights[i]);
  const totalCombined = combined.reduce((s, w) => s + w, 0);

  // Fall back to distance-only if all directional weights zero (no relevant swell)
  const weights = totalCombined > 0 ? combined : distanceWeights;
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const field = (key: keyof BuoyReading) =>
    idwAvg(
      entries.map((b, i) => ({
        val: b.reading[key] as number | null,
        weight: weights[i],
      })),
    );

  const observedAt = new Date(Math.min(...entries.map((b) => b.reading.observedAt.getTime())));

  const waveHeight = field('waveHeight');
  const dominantPeriod = field('dominantPeriod');

  return {
    waveHeight,
    dominantPeriod,
    swellPower: computeSwellPower(waveHeight, dominantPeriod),
    windSpeed: field('windSpeed'),
    windDirection: entries[weights.indexOf(Math.max(...weights))]?.reading.windDirection ?? null,
    waterTemp: field('waterTemp'),
    sources: entries.map((b, i) => ({
      stationId: b.station.id,
      stationName: b.station.name,
      distanceKm: Math.round(b.distanceKm),
      weight: parseFloat((weights[i] / totalWeight).toFixed(3)),
    })),
    observedAt,
    generatedAt: new Date(),
  };
}
