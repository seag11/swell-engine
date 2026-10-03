import type { BuoyReading, Steepness, WaveSystem } from '@swell-engine/shared';

const NDBC_BASE = 'https://www.ndbc.noaa.gov/data/realtime2';
const NDBC_FETCH_TIMEOUT_MS = 5_000;

// Rows are published every 10 minutes in the .txt file, but the wave sensor
// reports on a slower cycle — roughly every 30 — so about two rows in three
// carry MM for WVHT, DPD and MWD while wind and temperature are present. Taking
// the newest row unconditionally therefore reports "no wave data" based on
// nothing but when the request happened to land.
//
// Two hours as a window rather than a row count, because the cadence is not the
// same everywhere: the .spec file arrives every 30 minutes at some stations and
// hourly at others, so twelve rows is two hours in one file and twelve in
// another. Beyond the window the sensor really is out, and a met-only reading is
// the honest answer rather than a stale wave height dressed up as current.
const WAVE_LOOKBACK_MS = 2 * 3_600_000;

const MISSING = new Set(['MM', 'N/A', '-99', '-999', '']);

const isMissing = (value: string | undefined) => value === undefined || MISSING.has(value);

/**
 * NDBC prints SwD and WWD as compass points — "WNW", "SSE" — even though the
 * .spec header labels both columns degT. Every other direction in the feed is
 * numeric, so this is the one place a lookup is needed.
 */
const COMPASS: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

// NDBC's own classification of the sea state. A steep sea is already breaking
// offshore, which is where the breaking-height estimate loses its footing, so
// it is worth carrying through rather than recomputing.
const STEEPNESS: Record<string, Steepness> = {
  SWELL: 'swell',
  AVERAGE: 'average',
  STEEP: 'steep',
  VERY_STEEP: 'very_steep',
};

type Row = { observedAt: Date; cols: string[] };

async function fetchText(stationId: string, suffix: string): Promise<string | null> {
  const url = `${NDBC_BASE}/${stationId}${suffix}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(NDBC_FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      // A missing .spec is normal — not every station publishes one — so it is
      // logged at a lower volume than a missing .txt, which means no reading.
      console.warn(`NDBC ${stationId}${suffix}: HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`NDBC ${stationId}${suffix}: fetch error`, err);
    return null;
  }
}

export async function fetchLatestReading(stationId: string): Promise<BuoyReading | null> {
  // Both files in parallel: the summary carries wind and water temperature, the
  // spectral file carries the partition the model needs to tell a groundswell
  // from the chop on top of it. Neither contains the other's fields.
  const [stdMet, spectral] = await Promise.all([
    fetchText(stationId, '.txt'),
    fetchText(stationId, '.spec'),
  ]);

  if (stdMet === null) return null;

  const reading = parseStdMet(stationId, stdMet);
  if (reading === null) return null;

  return spectral === null
    ? reading
    : { ...reading, ...parseSpectral(stationId, spectral, reading.observedAt) };
}

// Two leading '#' rows (column names, then units), then data newest-first.
// Missing values are "MM".
function parseRows(text: string): Row[] {
  const rows: Row[] = [];
  for (const line of text.trim().split('\n')) {
    if (line.trim().length === 0 || line.startsWith('#')) continue;
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5) continue;
    const pad = (s: string) => s.padStart(2, '0');
    const observedAt = new Date(
      `${cols[0]}-${pad(cols[1])}-${pad(cols[2])}T${pad(cols[3])}:${pad(cols[4])}:00Z`,
    );
    if (isNaN(observedAt.getTime())) continue;
    rows.push({ observedAt, cols });
  }
  return rows;
}

/**
 * The newest row satisfying `usable`, within the lookback window of the newest
 * row in the file. Falls back to the newest row when nothing qualifies, so a
 * caller still gets whatever the station did report.
 */
function pickRow(rows: Row[], usable: (cols: string[]) => boolean): Row | null {
  if (rows.length === 0) return null;
  const cutoff = rows[0].observedAt.getTime() - WAVE_LOOKBACK_MS;
  return (
    rows.find((r) => r.observedAt.getTime() >= cutoff && usable(r.cols)) ?? rows[0]
  );
}

const num = (v: string): number | null => (isMissing(v) ? null : parseFloat(v));
const int = (v: string): number | null => (isMissing(v) ? null : parseInt(v, 10));
const bearing = (v: string): number | null =>
  isMissing(v) ? null : (COMPASS[v.toUpperCase()] ?? null);

// Standard Meteorological Data:
//   YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP ...
//    0  1  2  3  4    5    6   7    8   9  10  11   12   13   14
const MET = { waveHeight: 8, dominantPeriod: 9 } as const;

function parseStdMet(stationId: string, text: string): BuoyReading | null {
  const rows = parseRows(text);
  if (rows.length === 0) {
    console.warn(`NDBC ${stationId}: no data rows found`);
    return null;
  }

  // The model needs height and period together to estimate a breaking face, so
  // a row carrying only one of them is no more useful than a row carrying
  // neither.
  const row = pickRow(
    rows,
    (c) => !isMissing(c[MET.waveHeight]) && !isMissing(c[MET.dominantPeriod]),
  );
  if (row === null) return null;

  const { cols, observedAt } = row;
  if (cols.length < 15) {
    console.warn(`NDBC ${stationId}: unexpected column count ${cols.length}`);
    return null;
  }

  return {
    stationId,
    observedAt,
    createdAt: new Date(),
    windDirection: int(cols[5]),
    windSpeed: num(cols[6]),
    waveHeight: num(cols[8]),
    dominantPeriod: num(cols[9]),
    avgPeriod: num(cols[10]),
    waveDirection: int(cols[11]),
    waterTemp: num(cols[14]),
    swell: null,
    windWave: null,
    steepness: null,
  };
}

// Spectral Wave Summary:
//   YY MM DD hh mm WVHT SwH SwP WWH WWP SwD WWD STEEPNESS APD MWD
//    0  1  2  3  4    5   6   7   8   9  10  11        12  13  14
const SPEC = {
  swellHeight: 6,
  swellPeriod: 7,
  windWaveHeight: 8,
  windWavePeriod: 9,
  swellDirection: 10,
  windWaveDirection: 11,
  steepness: 12,
} as const;

type Partitions = Pick<BuoyReading, 'swell' | 'windWave' | 'steepness'>;

const EMPTY: Partitions = { swell: null, windWave: null, steepness: null };

const system = (height: string, period: string, direction: string): WaveSystem | null =>
  // Both height and period are needed to shoal a system, so a partition with
  // only one of them is treated as absent rather than half-reported.
  isMissing(height) || isMissing(period)
    ? null
    : { height: num(height), period: num(period), direction: bearing(direction) };

/**
 * The swell and wind-sea partition, which is what makes the model able to tell
 * a 16-second groundswell from 5-second chop instead of averaging them into a
 * mid-period wave that exists nowhere in the water.
 *
 * Returns nothing rather than failing when the file is unhelpful. Three of the
 * seeded stations publish a .spec whose partition columns are entirely MM — one
 * of them the nearest buoy to a preset break — so an absent partition is a
 * normal state, not an error.
 */
function parseSpectral(stationId: string, text: string, observedAt: Date): Partitions {
  const rows = parseRows(text);
  if (rows.length === 0) return EMPTY;

  const row = pickRow(rows, (c) => !isMissing(c[SPEC.swellHeight]));
  if (row === null) return EMPTY;

  // The two files are written on the same roughly half-hourly cycle but not to
  // the same minute, so they are matched by window rather than exactly. A
  // partition older than the summary reading by more than the window describes
  // a different sea and is dropped.
  if (Math.abs(row.observedAt.getTime() - observedAt.getTime()) > WAVE_LOOKBACK_MS) {
    console.warn(`NDBC ${stationId}.spec: partition too old to pair with the reading`);
    return EMPTY;
  }

  const { cols } = row;
  if (cols.length < 13) {
    console.warn(`NDBC ${stationId}.spec: unexpected column count ${cols.length}`);
    return EMPTY;
  }

  return {
    swell: system(
      cols[SPEC.swellHeight],
      cols[SPEC.swellPeriod],
      cols[SPEC.swellDirection],
    ),
    windWave: system(
      cols[SPEC.windWaveHeight],
      cols[SPEC.windWavePeriod],
      cols[SPEC.windWaveDirection],
    ),
    steepness: STEEPNESS[cols[SPEC.steepness]?.toUpperCase()] ?? null,
  };
}
