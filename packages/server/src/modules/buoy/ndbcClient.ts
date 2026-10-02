import type { BuoyReading } from '@swell-engine/shared';

const NDBC_BASE = 'https://www.ndbc.noaa.gov/data/realtime2';
const NDBC_FETCH_TIMEOUT_MS = 5_000;

export async function fetchLatestReading(stationId: string): Promise<BuoyReading | null> {
  const url = `${NDBC_BASE}/${stationId}.txt`;
  let text: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(NDBC_FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`NDBC ${stationId}: HTTP ${res.status}`);
      return null;
    }
    text = await res.text();
  } catch (err) {
    console.warn(`NDBC ${stationId}: fetch error`, err);
    return null;
  }
  return parseStdMet(stationId, text);
}

// Rows are published every 10 minutes, but the wave sensor reports on a slower
// cycle — roughly every 30 — so about two rows in three carry MM for WVHT, DPD
// and MWD while wind and temperature are present. Taking the newest row
// unconditionally therefore reports "no wave data" based on nothing but when
// the request happened to land.
//
// Twelve rows is about two hours. Beyond that the sensor really is out, and a
// met-only reading is the honest answer rather than a stale wave height dressed
// up as current.
const WAVE_LOOKBACK_ROWS = 12;

const COLUMN = { waveHeight: 8, dominantPeriod: 9 } as const;

const isMissing = (value: string | undefined) => value === undefined || value === 'MM';

/**
 * The newest row carrying both height and period, since the model needs the
 * pair to estimate a breaking face. Falls back to the newest row of any kind.
 */
function pickReadingRow(rows: string[][]): string[] {
  const withinLookback = rows.slice(0, WAVE_LOOKBACK_ROWS);
  const usable = withinLookback.find(
    (cols) =>
      !isMissing(cols[COLUMN.waveHeight]) && !isMissing(cols[COLUMN.dominantPeriod]),
  );
  return usable ?? rows[0];
}

// NDBC Standard Meteorological Data format:
// Two leading '#' rows (column names, then units), then data newest-first.
// Missing values are "MM".
function parseStdMet(stationId: string, text: string): BuoyReading | null {
  const rows = text
    .trim()
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/));

  if (rows.length === 0) {
    console.warn(`NDBC ${stationId}: no data rows found`);
    return null;
  }

  const cols = pickReadingRow(rows);
  if (cols.length < 15) {
    console.warn(`NDBC ${stationId}: unexpected column count ${cols.length}`);
    return null;
  }

  const num = (v: string): number | null => (v === 'MM' ? null : parseFloat(v));
  const int = (v: string): number | null => (v === 'MM' ? null : parseInt(v, 10));

  // cols: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP ...
  //        0   1  2  3  4    5    6   7    8   9  10  11  12   13   14
  const pad = (s: string) => s.padStart(2, '0');
  const timestamp = new Date(
    `${cols[0]}-${pad(cols[1])}-${pad(cols[2])}T${pad(cols[3])}:${pad(cols[4])}:00Z`,
  );
  if (isNaN(timestamp.getTime())) {
    console.warn(`NDBC ${stationId}: unparseable timestamp in "${cols.join(' ')}"`);
    return null;
  }

  return {
    stationId,
    observedAt: timestamp,
    createdAt: new Date(),
    windDirection: int(cols[5]),
    windSpeed: num(cols[6]),
    waveHeight: num(cols[8]),
    dominantPeriod: num(cols[9]),
    avgPeriod: num(cols[10]),
    waveDirection: int(cols[11]),
    waterTemp: num(cols[14]),
  };
}
