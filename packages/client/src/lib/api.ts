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

export type Steepness = 'swell' | 'average' | 'steep' | 'very_steep';

export type SystemKind = 'swell' | 'windWave' | 'total';

/** One wave system: a groundswell train or a local wind sea. */
export interface WaveSystem {
  height: number | null;
  period: number | null;
  direction: number | null;
}

export interface Conditions {
  waveHeight: number | null;
  /** Breaking face height in metres — the figure surf reports describe. */
  faceHeight: number | null;
  /** Highest tenth of breaking waves, for the upper end of a range. */
  faceHeightMax: number | null;
  /**
   * Which system the face came from. Each is shoaled at its own period and the
   * larger wins, so this distinguishes real groundswell from a big wind sea
   * that happens to break the same height.
   */
  faceFrom: SystemKind | null;
  swell: WaveSystem | null;
  windWave: WaveSystem | null;
  steepness: Steepness | null;
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
