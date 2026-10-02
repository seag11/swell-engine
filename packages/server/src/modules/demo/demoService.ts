import type { TriangulatedConditions } from '@swell-engine/shared';
import { getTriangulatedConditions } from '../buoy/index.js';

/**
 * One precomputed reading for the public landing page.
 *
 * The point is that an unauthenticated caller costs nothing. Every request
 * serves an already-assembled payload from memory: no database query, no NOAA
 * fetch, and critically no model subprocess. Spawning a Python interpreter per
 * anonymous request would be a cheap way to exhaust a small instance.
 *
 * Coordinates are fixed and the route takes no parameters, so the cache cannot
 * be missed on purpose. An endpoint accepting lat/lon would be an open proxy
 * whose cache is defeated by incrementing a decimal.
 */

const TTL_MS = 10 * 60_000;

// Tried in order until one has usable wave data. Buoys stay online while their
// wave sensors drop out — the Pacific Northwest stations report MM for days —
// so a single spot would eventually show the landing page "No wave data".
const CANDIDATES = [
  { label: 'Ocean Beach, SF', lat: 37.757, lon: -122.51, facing: 270 },
  { label: 'Trestles, CA', lat: 33.383, lon: -117.589, facing: 230 },
  { label: 'Montauk, NY', lat: 41.036, lon: -71.952, facing: 160 },
  { label: 'Cocoa Beach, FL', lat: 28.32, lon: -80.608, facing: 90 },
];

export interface DemoReading {
  spot: { label: string; lat: number; lon: number; facing: number };
  conditions: TriangulatedConditions;
  computedAt: string;
}

let cached: DemoReading | null = null;
let expiresAt = 0;
// Shared across concurrent callers so an expiry does not start a stampede of
// identical recomputations, each one spawning the model.
let inFlight: Promise<DemoReading | null> | null = null;

async function compute(): Promise<DemoReading | null> {
  for (const spot of CANDIDATES) {
    try {
      const conditions = await getTriangulatedConditions(spot.lat, spot.lon, spot.facing);
      if (conditions && conditions.faceHeight !== null) {
        return { spot, conditions, computedAt: new Date().toISOString() };
      }
    } catch (err) {
      console.warn(`[demo] ${spot.label} failed:`, (err as Error).message);
    }
  }
  console.warn('[demo] no candidate spot had usable wave data');
  return null;
}

export async function getDemoReading(): Promise<DemoReading | null> {
  if (cached && Date.now() < expiresAt) return cached;

  // Serve the stale copy while a refresh runs, rather than making the caller
  // that happened to arrive at expiry wait for the model.
  if (inFlight) return cached ?? inFlight;

  inFlight = compute()
    .then((fresh) => {
      if (fresh) {
        cached = fresh;
        expiresAt = Date.now() + TTL_MS;
      }
      return cached;
    })
    .finally(() => {
      inFlight = null;
    });

  return cached ?? inFlight;
}

/** Warms the cache at boot so the first visitor is never the one who waits. */
export async function warmDemoReading(): Promise<void> {
  const reading = await getDemoReading();
  console.log(
    reading
      ? `[demo] warmed with ${reading.spot.label}`
      : '[demo] warm failed, will retry on first request',
  );
}
