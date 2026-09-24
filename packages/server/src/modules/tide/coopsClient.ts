import type { TideExtreme, TideExtremeKind } from '@swell-engine/shared';

const COOPS_BASE = 'https://api.tidesandcurrents.noaa.gov';
const APPLICATION = 'swell-engine';
const STATIONS_TIMEOUT_MS = 20_000;
const PREDICTIONS_TIMEOUT_MS = 6_000;

export const MAX_STATION_DISTANCE_KM = 30;
const EARTH_RADIUS_KM = 6371;

export interface TideStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

type RawStation = { id: string; name: string; lat: number; lng: number };

// The station list is ~2MB of metadata that changes only when NOAA commissions a
// gauge, so one fetch per process is plenty. Stubbed in memory until this moves
// into Postgres alongside a nearest-station query.
let stationCache: RawStation[] | null = null;

async function getStations(): Promise<RawStation[]> {
  if (stationCache) return stationCache;
  const url = `${COOPS_BASE}/mdapi/prod/webapi/stations.json?type=tidepredictions&units=metric`;
  const res = await fetch(url, { signal: AbortSignal.timeout(STATIONS_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`CO-OPS station list: HTTP ${res.status}`);
  const body = (await res.json()) as { stations?: RawStation[] };
  stationCache = body.stations ?? [];
  return stationCache;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export async function findNearestStation(lat: number, lon: number): Promise<TideStation | null> {
  const stations = await getStations();
  let best: TideStation | null = null;
  for (const s of stations) {
    const distanceKm = haversineKm(lat, lon, s.lat, s.lng);
    if (!best || distanceKm < best.distanceKm) {
      best = { id: s.id, name: s.name, lat: s.lat, lon: s.lng, distanceKm };
    }
  }
  if (!best || best.distanceKm > MAX_STATION_DISTANCE_KM) return null;
  return { ...best, distanceKm: Math.round(best.distanceKm * 10) / 10 };
}

const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

// CO-OPS returns 'YYYY-MM-DD HH:mm' in the zone requested; we always ask for GMT.
const toIso = (t: string) => new Date(`${t.replace(' ', 'T')}:00Z`).toISOString();

/**
 * High and low predictions covering the given range.
 *
 * Only the `hilo` interval is requested. The continuous 30-minute series exists
 * for reference stations but errors for subordinate ones, which are frequently
 * the closest station to a break, so `hilo` is the one product available
 * everywhere. Callers reconstruct the curve with `tideLevelAt`.
 */
export async function fetchTideExtremes(
  stationId: string,
  from: Date,
  to: Date,
): Promise<TideExtreme[]> {
  const params = new URLSearchParams({
    application: APPLICATION,
    product: 'predictions',
    station: stationId,
    datum: 'MLLW',
    units: 'metric',
    time_zone: 'gmt',
    format: 'json',
    interval: 'hilo',
    begin_date: yyyymmdd(from),
    end_date: yyyymmdd(to),
  });

  const res = await fetch(`${COOPS_BASE}/api/prod/datagetter?${params}`, {
    signal: AbortSignal.timeout(PREDICTIONS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`CO-OPS predictions: HTTP ${res.status}`);

  const body = (await res.json()) as {
    predictions?: Array<{ t: string; v: string; type?: string }>;
    error?: { message: string };
  };
  if (body.error) throw new Error(`CO-OPS predictions: ${body.error.message}`);

  return (body.predictions ?? []).map((p) => ({
    t: toIso(p.t),
    level: parseFloat(p.v),
    kind: p.type as TideExtremeKind,
  }));
}
