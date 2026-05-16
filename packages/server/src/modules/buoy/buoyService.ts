import type { BuoyStation, BuoyReading, TriangulatedConditions } from '@swell-engine/shared'
import { sql } from '../../db/client.js'
import { config } from '../../config.js'
import { fetchLatestReading } from './ndbcClient.js'
import { triangulate } from './triangulation.js'

export async function getAllStations(): Promise<BuoyStation[]> {
  return sql<BuoyStation[]>`
    SELECT id, name, lat::float, lon::float, active
    FROM buoy_stations
    WHERE active = true
    ORDER BY name
  `
}

export async function getNearestStations(
  lat: number,
  lon: number,
  limit = 3
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
  `
}

export async function getLatestReadingFromDb(stationId: string): Promise<BuoyReading | null> {
  const rows = await sql<Array<{
    station_id:      string
    observed_at:     Date
    wave_height:     string | null
    dominant_period: string | null
    avg_period:      string | null
    wave_direction:  number | null
    wind_speed:      string | null
    wind_direction:  number | null
    water_temp:      string | null
  }>>`
    SELECT station_id, observed_at, wave_height, dominant_period, avg_period,
           wave_direction, wind_speed, wind_direction, water_temp
    FROM buoy_readings
    WHERE station_id = ${stationId}
      AND observed_at > NOW() - (${config.ndbcDataTtlHours} * INTERVAL '1 hour')
    ORDER BY observed_at DESC
    LIMIT 1
  `
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    stationId:      r.station_id,
    timestamp:      r.observed_at,
    waveHeight:     r.wave_height     ? parseFloat(r.wave_height)     : null,
    dominantPeriod: r.dominant_period ? parseFloat(r.dominant_period) : null,
    avgPeriod:      r.avg_period      ? parseFloat(r.avg_period)      : null,
    waveDirection:  r.wave_direction,
    windSpeed:      r.wind_speed      ? parseFloat(r.wind_speed)      : null,
    windDirection:  r.wind_direction,
    waterTemp:      r.water_temp      ? parseFloat(r.water_temp)      : null,
  }
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
  `
}

export async function storeReading(reading: BuoyReading): Promise<void> {
  await sql`
    INSERT INTO buoy_readings (
      station_id, observed_at, wave_height, dominant_period, avg_period,
      wave_direction, wind_speed, wind_direction, water_temp
    ) VALUES (
      ${reading.stationId},
      ${reading.timestamp},
      ${reading.waveHeight},
      ${reading.dominantPeriod},
      ${reading.avgPeriod},
      ${reading.waveDirection},
      ${reading.windSpeed},
      ${reading.windDirection},
      ${reading.waterTemp}
    )
    ON CONFLICT (station_id, observed_at) DO NOTHING
  `
}

function formatExpiry(timestamp: Date): string {
  const ms = timestamp.getTime() + config.ndbcDataTtlHours * 3_600_000 - Date.now()
  const totalMin = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export async function getTriangulatedConditions(
  lat: number,
  lon: number,
  facing?: number
): Promise<TriangulatedConditions | null> {
  const nearest = await getNearestStations(lat, lon, 3)
  if (nearest.length === 0) return null

  const buoysWithReadings = await Promise.all(
    nearest.map(async (station) => {
      let reading = await getLatestReadingFromDb(station.id)
      const source = reading ? 'cached' : 'live'
      if (!reading) {
        reading = await fetchLatestReading(station.id)
        if (reading) await storeReading(reading)
      }
      if (reading) {
        const dirStr = facing !== undefined && reading.waveDirection !== null
          ? ` | mwd ${reading.waveDirection}° dir ${Math.max(0, Math.cos((reading.waveDirection - facing) * Math.PI / 180)).toFixed(2)}`
          : ''
        console.log(`[conditions] ${station.id} (${station.name}) — ${source}, expires in ${formatExpiry(reading.timestamp)}${dirStr}`)
      } else {
        console.log(`[conditions] ${station.id} (${station.name}) — no data`)
      }
      return reading ? { station, reading } : null
    })
  )

  const valid = buoysWithReadings.filter(
    (b): b is { station: BuoyStation & { distanceKm: number }; reading: BuoyReading } => b !== null
  )
  if (valid.length === 0) return null

  return triangulate({ lat, lon }, valid, facing)
}
