import type { TideExtreme, TideExtremeKind } from '@swell-engine/shared';
import { sql } from '../../db/client.js';
import { fetchStationList, fetchTideExtremes } from './coopsClient.js';

const EARTH_RADIUS_KM = 6371;
const INSERT_CHUNK = 500;
const DAY_MS = 86_400_000;
// One fetch buys a year. The lookback covers the window's past leg plus the
// bracketing extreme that interpolation needs before it.
const COVERAGE_DAYS_AHEAD = 365;
const COVERAGE_DAYS_BEHIND = 3;

export const MAX_STATION_DISTANCE_KM = 30;

export interface TideStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

/**
 * Populates tide_stations from NOAA's station index, once per database.
 *
 * The index is ~2MB and changes only when a gauge is commissioned, so this skips
 * entirely when the table is already populated. Tide is supplementary, so a
 * failure here warns and lets the server start — the next boot retries.
 */
export async function seedTideStations(): Promise<void> {
  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM tide_stations
  `;
  if (count > 0) {
    console.log(`Tide stations already seeded (${count})`);
    return;
  }

  let stations;
  try {
    stations = await fetchStationList();
  } catch (err) {
    console.warn('[tide] station seed skipped:', (err as Error).message);
    return;
  }

  const rows = stations.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lon: s.lng,
    is_reference: s.type === 'R',
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    await sql`
      INSERT INTO tide_stations ${sql(chunk, 'id', 'name', 'lat', 'lon', 'is_reference')}
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`Seeded ${rows.length} tide stations`);
}

/**
 * Closest station, or null when none is near enough for the prediction to mean
 * anything. Tide phase shifts along a coast, so a distant station is worse than
 * no answer.
 */
export async function findNearestStation(lat: number, lon: number): Promise<TideStation | null> {
  const rows = await sql<Array<TideStation>>`
    SELECT
      id, name, lat::float, lon::float,
      ROUND((
        ${EARTH_RADIUS_KM} * SQRT(
          POWER((RADIANS(${lon}) - RADIANS(lon)) * COS(RADIANS((${lat} + lat) / 2)), 2) +
          POWER(RADIANS(${lat}) - RADIANS(lat), 2)
        )
      )::numeric, 1)::float AS "distanceKm"
    FROM tide_stations
    ORDER BY "distanceKm"
    LIMIT 1
  `;

  const nearest = rows[0];
  if (!nearest || nearest.distanceKm > MAX_STATION_DISTANCE_KM) return null;
  return nearest;
}

/**
 * Guarantees stored extremes reach `throughMs`, fetching a year if they don't.
 *
 * Predictions are harmonic, so a stored extreme never becomes wrong — only the
 * far edge of coverage moves. That makes one fetch per station per year
 * sufficient, and keeps NOAA out of the request path after a station's first
 * view. Two simultaneous first views can both fetch; the writes are idempotent,
 * so the cost is one redundant call rather than bad data.
 */
export async function ensureCoverage(stationId: string, throughMs: number): Promise<void> {
  const [row] = await sql<[{ covered_through: Date | null }]>`
    SELECT covered_through FROM tide_stations WHERE id = ${stationId}
  `;
  if (row?.covered_through && row.covered_through.getTime() >= throughMs) return;

  const from = new Date(Date.now() - COVERAGE_DAYS_BEHIND * DAY_MS);
  const to = new Date(Date.now() + COVERAGE_DAYS_AHEAD * DAY_MS);
  const extremes = await fetchTideExtremes(stationId, from, to);
  if (extremes.length === 0) return;

  const rows = extremes.map((e) => ({
    station_id: stationId,
    occurs_at: e.t,
    level_m: e.level,
    kind: e.kind,
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    await sql`
      INSERT INTO tide_extremes ${sql(chunk, 'station_id', 'occurs_at', 'level_m', 'kind')}
      ON CONFLICT (station_id, occurs_at) DO NOTHING
    `;
  }

  await sql`
    UPDATE tide_stations SET covered_through = ${to} WHERE id = ${stationId}
  `;
  console.log(`[tide] cached ${rows.length} extremes for ${stationId} through ${to.toISOString().slice(0, 10)}`);
}

/** Stored extremes in a range. Callers must include bracketing extremes. */
export async function getExtremes(
  stationId: string,
  from: Date,
  to: Date,
): Promise<TideExtreme[]> {
  const rows = await sql<Array<{ occurs_at: Date; level_m: number; kind: TideExtremeKind }>>`
    SELECT occurs_at, level_m::float, kind
    FROM tide_extremes
    WHERE station_id = ${stationId}
      AND occurs_at BETWEEN ${from} AND ${to}
    ORDER BY occurs_at
  `;
  return rows.map((r) => ({
    t: r.occurs_at.toISOString(),
    level: r.level_m,
    kind: r.kind,
  }));
}
