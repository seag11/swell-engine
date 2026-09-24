import { sql } from '../../db/client.js';
import { fetchStationList } from './coopsClient.js';

const EARTH_RADIUS_KM = 6371;
const INSERT_CHUNK = 500;

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
