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

export type ConditionTone = 'flat' | 'small' | 'solid' | 'large' | 'xxl'

export function classifyTone(waveHeightMeters: number | null): ConditionTone {
  if (waveHeightMeters === null) return 'flat'
  const ft = waveHeightMeters * 3.28084
  if (ft < 1)  return 'flat'
  if (ft < 3)  return 'small'
  if (ft < 6)  return 'solid'
  if (ft < 10) return 'large'
  return 'xxl'
}
