import type { TideExtreme, TideExtremeKind } from '@swell-engine/shared';

const COOPS_BASE = 'https://api.tidesandcurrents.noaa.gov';
const APPLICATION = 'swell-engine';
const STATIONS_TIMEOUT_MS = 30_000;
const PREDICTIONS_TIMEOUT_MS = 10_000;

export interface RawTideStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string; // 'R' reference, 'S' subordinate
}

/** NOAA's full tide-prediction station index (~2MB). Seeding only. */
export async function fetchStationList(): Promise<RawTideStation[]> {
  const url = `${COOPS_BASE}/mdapi/prod/webapi/stations.json?type=tidepredictions&units=metric`;
  const res = await fetch(url, { signal: AbortSignal.timeout(STATIONS_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`CO-OPS station list: HTTP ${res.status}`);
  const body = (await res.json()) as { stations?: RawTideStation[] };
  return body.stations ?? [];
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
