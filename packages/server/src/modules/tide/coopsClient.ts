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

export interface TidePoint {
  t: string;
  level: number;
}

export interface TideExtreme extends TidePoint {
  kind: 'H' | 'L';
}

type RawStation = { id: string; name: string; lat: number; lng: number };

// The station list is ~2MB of metadata that only changes when NOAA commissions a
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
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
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

async function fetchPredictions(
  stationId: string,
  from: Date,
  to: Date,
  interval: '30' | 'hilo',
): Promise<Array<{ t: string; v: string; type?: string }>> {
  const params = new URLSearchParams({
    application: APPLICATION,
    product: 'predictions',
    station: stationId,
    datum: 'MLLW',
    units: 'metric',
    time_zone: 'gmt',
    format: 'json',
    interval,
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
  return body.predictions ?? [];
}

// CO-OPS returns 'YYYY-MM-DD HH:mm' in the requested zone; we ask for GMT.
const toIso = (t: string) => new Date(`${t.replace(' ', 'T')}:00Z`).toISOString();

export async function fetchTideWindow(
  stationId: string,
  from: Date,
  to: Date,
): Promise<{ curve: TidePoint[]; extremes: TideExtreme[] }> {
  const [rawCurve, rawExtremes] = await Promise.all([
    fetchPredictions(stationId, from, to, '30'),
    fetchPredictions(stationId, from, to, 'hilo'),
  ]);

  // Requests are day-granular, so trim to the caller's actual window.
  const inWindow = (iso: string) => {
    const ms = Date.parse(iso);
    return ms >= from.getTime() && ms <= to.getTime();
  };

  const curve = rawCurve
    .map((p) => ({ t: toIso(p.t), level: parseFloat(p.v) }))
    .filter((p) => inWindow(p.t));

  const extremes = rawExtremes
    .map((p) => ({ t: toIso(p.t), level: parseFloat(p.v), kind: p.type as 'H' | 'L' }))
    .filter((p) => inWindow(p.t));

  return { curve, extremes };
}
