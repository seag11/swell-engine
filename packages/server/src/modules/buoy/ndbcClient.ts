import type { BuoyReading } from '@swell-engine/shared';

const NDBC_BASE = 'https://www.ndbc.noaa.gov/data/realtime2';

export async function fetchLatestReading(stationId: string): Promise<BuoyReading | null> {
  const url = `${NDBC_BASE}/${stationId}.txt`;
  let text: string;
  try {
    const res = await fetch(url);
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

// NDBC Standard Meteorological Data format:
// Row 0: column names  (#YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP ...)
// Row 1: column units
// Row 2+: data, missing values as "MM"
function parseStdMet(stationId: string, text: string): BuoyReading | null {
  const lines = text
    .trim()
    .split('\n')
    .filter((l) => l.trim().length > 0);
  const dataLine = lines[2];
  if (!dataLine) return null;

  const cols = dataLine.trim().split(/\s+/);
  if (cols.length < 15) return null;

  const num = (v: string): number | null => (v === 'MM' ? null : parseFloat(v));
  const int = (v: string): number | null => (v === 'MM' ? null : parseInt(v, 10));

  // cols: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP ...
  //        0   1  2  3  4    5    6   7    8   9  10  11  12   13   14
  const pad = (s: string) => s.padStart(2, '0');
  const timestamp = new Date(
    `${cols[0]}-${pad(cols[1])}-${pad(cols[2])}T${pad(cols[3])}:${pad(cols[4])}:00Z`,
  );
  if (isNaN(timestamp.getTime())) return null;

  return {
    stationId,
    timestamp,
    windDirection: int(cols[5]),
    windSpeed: num(cols[6]),
    waveHeight: num(cols[8]),
    dominantPeriod: num(cols[9]),
    avgPeriod: num(cols[10]),
    waveDirection: int(cols[11]),
    waterTemp: num(cols[14]),
  };
}
