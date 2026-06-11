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

export interface TriangulatedConditions {
  waveHeight: number | null
  dominantPeriod: number | null
  swellPower: number | null
  windSpeed: number | null
  windDirection: number | null
  waterTemp: number | null
  sources: Array<{
    stationId: string
    stationName: string
    distanceKm: number
    weight: number
  }>
  observedAt: Date
  generatedAt: Date
}

export { computeSwellPower } from './waveDynamics.js'

export type ConditionTone = 'flat' | 'small' | 'solid' | 'large' | 'xxl'

// Swell power index (H² × T) above which tone is upgraded one level.
// P≈20 captures meaningful ground swell — e.g. 1.5m @ 9s or 1m @ 14s —
// while ignoring short-period wind chop at the same heights.
const HIGH_POWER_THRESHOLD = 20

export function classifyTone(
  waveHeightMeters: number | null,
  swellPower?: number | null,
): ConditionTone {
  if (waveHeightMeters === null) return 'flat'
  const ft = waveHeightMeters * 3.28084
  if (ft < 1) return 'flat'

  const highPower = swellPower != null && swellPower > HIGH_POWER_THRESHOLD

  if (ft < 3)  return highPower ? 'solid' : 'small'
  if (ft < 6)  return highPower ? 'large' : 'solid'
  if (ft < 10) return highPower ? 'xxl'   : 'large'
  return 'xxl'
}
