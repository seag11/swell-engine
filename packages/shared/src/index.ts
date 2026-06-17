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

export { computeSwellPower, classifyTone } from './waveDynamics.js'
export type { ConditionTone } from './waveDynamics.js'
