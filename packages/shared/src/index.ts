export interface BuoyStation {
  id: string
  name: string
  lat: number
  lon: number
  active: boolean
}

export interface BuoyReading {
  stationId: string
  observedAt: Date
  createdAt: Date
  waveHeight: number | null      // meters
  dominantPeriod: number | null  // seconds
  avgPeriod: number | null       // seconds
  waveDirection: number | null   // degrees true
  windSpeed: number | null       // m/s
  windDirection: number | null   // degrees true
  waterTemp: number | null       // °C
}

/** The API response shape: a reading plus the attribution the model omits. */
export interface TriangulatedConditions {
  waveHeight: number | null
  dominantPeriod: number | null
  swellPower: number | null
  /** Breaking face height in metres — what surf reports describe. */
  faceHeight: number | null
  /** Highest tenth of breaking waves, for the upper end of a reported range. */
  faceHeightMax: number | null
  windSpeed: number | null
  windDirection: number | null
  waterTemp: number | null
  tone: string
  sources: Array<{
    stationId: string
    stationName: string
    /** Position, so a client can draw the stations at their true bearing. */
    lat: number
    lon: number
    distanceKm: number
    weight: number
  }>
  observedAt: string
  generatedAt: string
}

export { tideLevelAt, sampleTideCurve } from './tide.js'
export type { TideExtreme, TideExtremeKind } from './tide.js'
