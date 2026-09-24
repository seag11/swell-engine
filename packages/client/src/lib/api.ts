export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...options, credentials: 'include' });
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
  distanceKm: number;
  weight: number;
}

export interface Conditions {
  waveHeight: number | null;
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
