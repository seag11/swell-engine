export interface BuoyStation {
  id: string
  name: string
  lat: number
  lon: number
  active: boolean
}

/** NDBC's own sea-state classification, from the station's .spec file. */
export type Steepness = 'swell' | 'average' | 'steep' | 'very_steep'

/** Which wave system a derived figure came from. */
export type SystemKind = 'swell' | 'windWave' | 'total'

/**
 * One wave system: a groundswell train or a local wind sea.
 *
 * The sea at a buoy is almost never one wave. Heights combine in quadrature —
 * energy adds, and energy goes as the square — so a 1.3m swell under a 2.0m
 * wind sea reads as 2.4m total, not 3.3m.
 */
export interface WaveSystem {
  height: number | null          // meters, this system alone
  period: number | null          // seconds
  direction: number | null       // degrees true, whence it comes
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
  /** Null where the station publishes no partition, which is not rare. */
  swell: WaveSystem | null
  windWave: WaveSystem | null
  steepness: Steepness | null
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
  /**
   * Which system produced faceHeight. Each is shoaled at its own period and the
   * larger face wins, so a short-period wind sea can outrank a groundswell.
   * 'total' means no station in the set published a partition.
   */
  faceFrom: SystemKind | null
  swell: WaveSystem | null
  windWave: WaveSystem | null
  steepness: Steepness | null
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
