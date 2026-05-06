import { useState } from 'react'

interface ConditionSource {
  stationId: string
  stationName: string
  distanceKm: number
  weight: number
}

interface Conditions {
  waveHeight: number | null
  dominantPeriod: number | null
  windSpeed: number | null
  windDirection: number | null
  waterTemp: number | null
  tone: string
  sources: ConditionSource[]
  generatedAt: string
}

const PRESETS = [
  { label: 'Ocean Beach, SF',  lat: 37.757,  lon: -122.510 },
  { label: 'Mavericks, CA',    lat: 37.495,  lon: -122.497 },
  { label: 'Trestles, CA',     lat: 33.383,  lon: -117.589 },
  { label: 'Pipeline, HI',     lat: 21.665,  lon: -158.053 },
  { label: 'Montauk, NY',      lat: 41.036,  lon:  -71.952 },
]

const WIND_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

function degToCompass(deg: number | null): string {
  if (deg === null) return 'N/A'
  return WIND_DIRS[Math.round(deg / 22.5) % 16]
}

function fmtWaveHeight(m: number | null): string {
  if (m === null) return 'N/A'
  return `${m.toFixed(1)}m / ${(m * 3.28084).toFixed(1)}ft`
}

function fmtWind(mps: number | null, dir: number | null): string {
  if (mps === null) return 'N/A'
  return `${(mps * 1.944).toFixed(0)} kts ${degToCompass(dir)}`
}

const TONE_COLORS: Record<string, string> = {
  flat:  'text-slate-400',
  small: 'text-sky-400',
  solid: 'text-green-400',
  large: 'text-yellow-400',
  xxl:   'text-red-400',
}

export default function App() {
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [conditions, setConditions] = useState<Conditions | null>(null)
  const [loading, setLoading] = useState(false)
  const [geolocating, setGeolocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchConditions = async (latVal: string, lonVal: string) => {
    setLoading(true)
    setError(null)
    setConditions(null)
    try {
      const res = await fetch(`/api/buoy/conditions?lat=${latVal}&lon=${lonVal}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Request failed')
      setConditions(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handlePreset = (presetLat: number, presetLon: number) => {
    const latStr = String(presetLat)
    const lonStr = String(presetLon)
    setLat(latStr)
    setLon(lonStr)
    fetchConditions(latStr, lonStr)
  }

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setGeolocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latStr = pos.coords.latitude.toFixed(4)
        const lonStr = pos.coords.longitude.toFixed(4)
        setLat(latStr)
        setLon(lonStr)
        setGeolocating(false)
        fetchConditions(latStr, lonStr)
      },
      () => {
        setError('Location access denied or unavailable')
        setGeolocating(false)
      }
    )
  }

  const stats = conditions
    ? [
        { label: 'Wave Height',     value: fmtWaveHeight(conditions.waveHeight) },
        { label: 'Dominant Period', value: conditions.dominantPeriod ? `${conditions.dominantPeriod.toFixed(1)}s` : 'N/A' },
        { label: 'Wind',            value: fmtWind(conditions.windSpeed, conditions.windDirection) },
        { label: 'Water Temp',      value: conditions.waterTemp ? `${conditions.waterTemp.toFixed(1)}°C` : 'N/A' },
      ]
    : []

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Swell Engine</h1>
      <p className="text-slate-400 text-sm mb-8">
        Triangulated buoy conditions via NOAA NDBC inverse-distance weighting
      </p>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.lat, p.lon)}
            disabled={loading || geolocating}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded px-3 py-1.5 text-sm transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Coordinate inputs + actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <input
          type="text"
          placeholder="Latitude  e.g. 37.76"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded px-3 py-2 w-44 focus:outline-none focus:border-blue-500"
        />
        <input
          type="text"
          placeholder="Longitude  e.g. -122.43"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded px-3 py-2 w-48 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => fetchConditions(lat, lon)}
          disabled={loading || geolocating || !lat || !lon}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded px-4 py-2 font-medium transition-colors"
        >
          {loading ? 'Fetching…' : 'Get Conditions'}
        </button>
        <button
          onClick={handleGeolocate}
          disabled={loading || geolocating}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded px-4 py-2 text-sm transition-colors"
        >
          {geolocating ? 'Locating…' : '⌖ Use my location'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {conditions && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ label, value }) => (
              <div key={label} className="bg-slate-800 rounded-lg p-4">
                <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">{label}</div>
                <div className="text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-800 rounded-lg p-4 flex items-center gap-3">
            <span className="text-slate-400 text-xs uppercase tracking-wide">Condition</span>
            <span className={`text-xl font-bold capitalize ${TONE_COLORS[conditions.tone] ?? ''}`}>
              {conditions.tone}
            </span>
          </div>

          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-3">Buoy Sources</div>
            <div className="space-y-2">
              {conditions.sources.map((s) => (
                <div key={s.stationId} className="flex justify-between text-sm">
                  <span className="text-slate-200">
                    {s.stationName}
                    <span className="text-slate-500 ml-1">({s.stationId})</span>
                  </span>
                  <span className="text-slate-400">
                    {s.distanceKm} km &mdash; {(s.weight * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-slate-600 text-xs text-right">
            Generated {new Date(conditions.generatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
