import type { BuoyStation, BuoyReading, TriangulatedConditions } from '@swell-engine/shared';
import { sql } from '../../db/client.js';
import { config } from '../../config.js';
import { fetchLatestReading } from './ndbcClient.js';
import { triangulate } from './triangulation.js';

const TRIANGULATION_STATION_LIMIT = 3;
const STALE_READING_THRESHOLD_MS = 4 * 3_600_000;

type ReadingSource = 'cached' | 'live';

export async function getAllStations(): Promise<BuoyStation[]> {
  return sql<BuoyStation[]>`
    SELECT id, name, lat::float, lon::float, active
    FROM buoy_stations
    WHERE active = true
    ORDER BY name
  `;
}

export async function getNearestStations(
  lat: number,
  lon: number,
  limit = TRIANGULATION_STATION_LIMIT,
): Promise<Array<BuoyStation & { distanceKm: number }>> {
  return sql<Array<BuoyStation & { distanceKm: number }>>`
    SELECT
      id, name, lat::float, lon::float, active,
      (
        6371 * SQRT(
          POWER((RADIANS(${lon}) - RADIANS(lon)) * COS(RADIANS((${lat} + lat) / 2)), 2) +
          POWER(RADIANS(${lat}) - RADIANS(lat), 2)
        )
      ) AS "distanceKm"
    FROM buoy_stations
    WHERE active = true
    ORDER BY "distanceKm"
    LIMIT ${limit}
  `;
}

export async function getLatestReadingFromDb(stationId: string): Promise<BuoyReading | null> {
  const rows = await sql<
    Array<{
      station_id: string;
      observed_at: Date;
      created_at: Date;
      wave_height: string | null;
      dominant_period: string | null;
      avg_period: string | null;
      wave_direction: number | null;
      wind_speed: string | null;
      wind_direction: number | null;
      water_temp: string | null;
    }>
  >`
    SELECT station_id, observed_at, created_at, wave_height, dominant_period, avg_period,
           wave_direction, wind_speed, wind_direction, water_temp
    FROM buoy_readings
    WHERE station_id = ${stationId}
      AND observed_at > NOW() - (${config.ndbcDataTtlHours} * INTERVAL '1 hour')
    ORDER BY observed_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    stationId: r.station_id,
    observedAt: r.observed_at,
    createdAt: r.created_at,
    waveHeight: r.wave_height ? parseFloat(r.wave_height) : null,
    dominantPeriod: r.dominant_period ? parseFloat(r.dominant_period) : null,
    avgPeriod: r.avg_period ? parseFloat(r.avg_period) : null,
    waveDirection: r.wave_direction,
    windSpeed: r.wind_speed ? parseFloat(r.wind_speed) : null,
    windDirection: r.wind_direction,
    waterTemp: r.water_temp ? parseFloat(r.water_temp) : null,
  };
}

export async function getStaleStations(): Promise<BuoyStation[]> {
  return sql<BuoyStation[]>`
    SELECT s.id, s.name, s.lat::float, s.lon::float, s.active
    FROM buoy_stations s
    WHERE s.active = true
      AND (
        NOT EXISTS (
          SELECT 1 FROM buoy_readings r WHERE r.station_id = s.id
        )
        OR (
          SELECT MAX(observed_at) FROM buoy_readings r WHERE r.station_id = s.id
        ) < NOW() - (${config.ndbcDataTtlHours} * INTERVAL '1 hour')
      )
  `;
}

export async function storeReading(reading: BuoyReading): Promise<void> {
  await sql`
    INSERT INTO buoy_readings (
      station_id, observed_at, wave_height, dominant_period, avg_period,
      wave_direction, wind_speed, wind_direction, water_temp
    ) VALUES (
      ${reading.stationId},
      ${reading.observedAt},
      ${reading.waveHeight},
      ${reading.dominantPeriod},
      ${reading.avgPeriod},
      ${reading.waveDirection},
      ${reading.windSpeed},
      ${reading.windDirection},
      ${reading.waterTemp}
    )
    ON CONFLICT (station_id, observed_at) DO NOTHING
  `;
}

function logStationReading(
  stationId: string,
  stationName: string,
  reading: BuoyReading,
  source: ReadingSource,
  facing?: number,
): void {
  const ageMs = Date.now() - reading.observedAt.getTime();
  if (ageMs > STALE_READING_THRESHOLD_MS) {
    console.warn(
      `[conditions] ${stationId} (${stationName}) — stale reading observed ${(ageMs / 3_600_000).toFixed(1)}h ago`,
    );
  }
  const dirStr =
    facing !== undefined && reading.waveDirection !== null
      ? ` | mwd ${reading.waveDirection}° dir ${Math.max(0, Math.cos(((reading.waveDirection - facing) * Math.PI) / 180)).toFixed(2)}`
      : '';
  console.log(
    `[conditions] ${stationId} (${stationName}) — ${source}, expires in ${formatExpiry(reading.observedAt)}${dirStr}`,
  );
}

/** Returns a cached reading if within TTL, otherwise fetches live from NDBC. */
async function resolveReading(
  stationId: string,
): Promise<{ reading: BuoyReading; source: ReadingSource } | null> {
  const cached = await getLatestReadingFromDb(stationId);
  if (cached) return { reading: cached, source: 'cached' };

  const live = await fetchLatestReading(stationId);
  if (live) {
    await storeReading(live);
    return { reading: live, source: 'live' };
  }

  return null;
}

function formatExpiry(observedAt: Date): string {
  const ms = observedAt.getTime() + config.ndbcDataTtlHours * 3_600_000 - Date.now();
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export async function getTriangulatedConditions(
  lat: number,
  lon: number,
  facing?: number,
): Promise<TriangulatedConditions | null> {
  const nearest = await getNearestStations(lat, lon, TRIANGULATION_STATION_LIMIT);
  if (nearest.length === 0) {
    console.warn(`[conditions] no active stations found near (${lat}, ${lon})`);
    return null;
  }

  const buoysWithReadings = await Promise.all(
    nearest.map(async (station) => {
      const result = await resolveReading(station.id);
      if (result) {
        logStationReading(station.id, station.name, result.reading, result.source, facing);
        return { station, reading: result.reading };
      }
      console.log(`[conditions] ${station.id} (${station.name}) — no data`);
      return null;
    }),
  );

  const valid = buoysWithReadings.filter(
    (
      b,
    ): b is {
      station: BuoyStation & { distanceKm: number };
      reading: BuoyReading;
    } => b !== null,
  );
  if (valid.length === 0) {
    console.warn(`[conditions] no readable data for any station near (${lat}, ${lon})`);
    return null;
  }

  return triangulate({ lat, lon }, valid, facing);
}
