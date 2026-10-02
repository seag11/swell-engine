export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...options, credentials: 'include' });
}

/** The one public reading, from /api/demo/conditions. */
export interface DemoReading {
  spot: { label: string; lat: number; lon: number; facing: number };
  conditions: Conditions;
  computedAt: string;
}

export interface Tide {
  station: { id: string; name: string; distanceKm: number };
  datum: string;
  units: string;
  window: { from: string; to: string };
  now: { at: string; level: number; trend: 'rising' | 'falling' };
  next: { kind: 'H' | 'L'; at: string; level: number; inMinutes: number } | null;
  extremes: Array<{ t: string; level: number; kind: 'H' | 'L' }>;
}

export interface ConditionSource {
  stationId: string;
  stationName: string;
  /** Position, so the plan view can place the station at its true bearing. */
  lat: number;
  lon: number;
  distanceKm: number;
  weight: number;
}

export interface Conditions {
  waveHeight: number | null;
  /** Breaking face height in metres — the figure surf reports describe. */
  faceHeight: number | null;
  /** Highest tenth of breaking waves, for the upper end of a range. */
  faceHeightMax: number | null;
  dominantPeriod: number | null;
  swellPower: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  waterTemp: number | null;
  tone: string;
  sources: ConditionSource[];
  observedAt: string;
  generatedAt: string;
}
