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
