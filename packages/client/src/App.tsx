import { useState } from 'react';
import { validateLat, validateLon } from '@/lib/validateCoords';
import { PRESETS } from '@/lib/presets';
import { useTheme } from '@/lib/useTheme';
import type { Conditions } from '@/lib/api';

const M_TO_FT = 3.28084;
const MPS_TO_KNOTS = 1.944;

// prettier-ignore
const WIND_DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function degToCompass(deg: number | null): string {
  if (deg === null) return 'N/A';
  return WIND_DIRS[Math.round(deg / 22.5) % 16];
}

function fmtWaveHeight(m: number | null): string {
  if (m === null) return 'N/A';
  return `${m.toFixed(1)}m / ${(m * M_TO_FT).toFixed(1)}ft`;
}

function fmtPeriod(s: number | null): string {
  if (s === null) return 'N/A';
  return `${s.toFixed(1)}s`;
}

function fmtTemp(c: number | null): string {
  if (c === null) return 'N/A';
  return `${c.toFixed(1)}°C`;
}

function fmtWind(mps: number | null, dir: number | null): string {
  if (mps === null) return 'N/A';
  return `${(mps * MPS_TO_KNOTS).toFixed(0)} kts ${degToCompass(dir)}`;
}

const TONE_COLORS: Record<string, string> = {
  flat:  'text-sw-muted dark:text-sw-dark-muted',
  small: 'text-sw-blue',
  solid: 'text-sw-green',
  large: 'text-sw-amber',
  xxl:   'text-sw-red',
};

export default function App() {
  const { theme, toggle } = useTheme();
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [latError, setLatError] = useState<string | null>(null);
  const [lonError, setLonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directionalWeightingApplied, setDirectionalWeightingApplied] = useState(false);

  const clearErrors = () => {
    setLatError(null);
    setLonError(null);
  };

  const fetchConditions = async (latVal: string, lonVal: string, facing?: number) => {
    setLoading(true);
    setError(null);
    setConditions(null);
    setDirectionalWeightingApplied(false);
    try {
      const params = new URLSearchParams({ lat: latVal, lon: lonVal });
      if (facing !== undefined) params.set('facing', String(facing));
      const res = await fetch(`/api/buoy/conditions?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Request failed');
      setConditions(body);
      setDirectionalWeightingApplied(facing !== undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (presetLat: number, presetLon: number, facing?: number) => {
    const latStr = String(presetLat);
    const lonStr = String(presetLon);
    setLat(latStr);
    setLon(lonStr);
    clearErrors();
    fetchConditions(latStr, lonStr, facing);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setGeolocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latStr = pos.coords.latitude.toFixed(4);
        const lonStr = pos.coords.longitude.toFixed(4);
        setLat(latStr);
        setLon(lonStr);
        clearErrors();
        setGeolocating(false);
        fetchConditions(latStr, lonStr);
      },
      () => {
        setError('Location access denied or unavailable');
        setGeolocating(false);
      },
    );
  };

  const stats = conditions
    ? [
        { label: 'Wave Height', value: fmtWaveHeight(conditions.waveHeight) },
        { label: 'Dominant Period', value: fmtPeriod(conditions.dominantPeriod) },
        { label: 'Wind', value: fmtWind(conditions.windSpeed, conditions.windDirection) },
        { label: 'Water Temp', value: fmtTemp(conditions.waterTemp) },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sw-bg to-sw-card dark:from-sw-dark-bg dark:to-sw-dark-card text-sw-strong dark:text-sw-dark-strong p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-start mb-1">
        <h1 className="text-3xl font-bold">Swell Engine</h1>
        <button
          onClick={toggle}
          className="text-sw-muted dark:text-sw-dark-muted hover:text-sw-strong dark:hover:text-sw-dark-strong transition-colors text-lg"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
      <p className="text-sw-muted dark:text-sw-dark-muted text-sm mb-8">
        Triangulated buoy conditions via NOAA NDBC inverse-distance weighting
      </p>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.lat, p.lon, p.facing)}
            disabled={loading || geolocating}
            className="bg-sw-card hover:bg-sw-border dark:bg-sw-dark-card dark:hover:bg-sw-dark-border text-sw-text dark:text-sw-dark-text disabled:opacity-40 rounded-full px-3 py-1.5 text-sm transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Coordinate inputs + actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex flex-col gap-1">
          <input
            type="text"
            placeholder="Latitude  e.g. 37.76"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            onBlur={() => setLatError(validateLat(lat))}
            className={`bg-sw-bg dark:bg-sw-dark-bg text-sw-strong dark:text-sw-dark-strong placeholder:text-sw-muted dark:placeholder:text-sw-dark-muted border rounded-lg px-3 py-2 w-44 focus:outline-none focus:border-sw-blue transition-colors ${latError ? 'border-sw-red' : 'border-sw-border dark:border-sw-dark-border'}`}
          />
          {latError && <span className="text-sw-red text-xs">{latError}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <input
            type="text"
            placeholder="Longitude  e.g. -122.43"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            onBlur={() => setLonError(validateLon(lon))}
            className={`bg-sw-bg dark:bg-sw-dark-bg text-sw-strong dark:text-sw-dark-strong placeholder:text-sw-muted dark:placeholder:text-sw-dark-muted border rounded-lg px-3 py-2 w-48 focus:outline-none focus:border-sw-blue transition-colors ${lonError ? 'border-sw-red' : 'border-sw-border dark:border-sw-dark-border'}`}
          />
          {lonError && <span className="text-sw-red text-xs">{lonError}</span>}
        </div>
        <button
          onClick={() => fetchConditions(lat, lon)}
          disabled={loading || geolocating || !lat || !lon || !!latError || !!lonError}
          className="bg-sw-blue hover:bg-[#2580B8] text-white disabled:opacity-40 rounded-lg px-4 py-2 font-medium transition-colors"
        >
          {loading ? 'Fetching…' : 'Get Conditions'}
        </button>
        <button
          onClick={handleGeolocate}
          disabled={loading || geolocating}
          className="bg-sw-card hover:bg-sw-border dark:bg-sw-dark-card dark:hover:bg-sw-dark-border text-sw-text dark:text-sw-dark-text disabled:opacity-40 rounded-lg px-4 py-2 text-sm transition-colors"
        >
          {geolocating ? 'Locating…' : '⌖ Use my location'}
        </button>
      </div>

      {error && (
        <div className="bg-sw-red/10 border border-sw-red rounded-lg p-4 mb-6 text-sw-red text-sm">
          {error}
        </div>
      )}

      {conditions && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ label, value }) => (
              <div key={label} className="bg-sw-card dark:bg-sw-dark-card rounded-xl p-4">
                <div className="text-sw-muted dark:text-sw-dark-muted text-xs uppercase tracking-wide mb-1">{label}</div>
                <div className="text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-sw-card dark:bg-sw-dark-card rounded-xl p-4 flex items-center gap-3">
            <span className="text-sw-muted dark:text-sw-dark-muted text-xs uppercase tracking-wide">Condition</span>
            <span className={`text-xl font-bold capitalize ${TONE_COLORS[conditions.tone] ?? ''}`}>
              {conditions.tone}
            </span>
          </div>

          <div className="bg-sw-card dark:bg-sw-dark-card rounded-xl p-4">
            <div className="text-sw-muted dark:text-sw-dark-muted text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
              Buoy Sources
              {directionalWeightingApplied && (
                <span className="text-sw-blue normal-case tracking-normal font-medium">
                  ↗ directional weighting
                </span>
              )}
            </div>
            <div className="space-y-2">
              {conditions.sources.map((s) => (
                <div key={s.stationId} className="flex justify-between text-sm">
                  <span className="text-sw-strong dark:text-sw-dark-strong">
                    {s.stationName}
                    <span className="text-sw-muted dark:text-sw-dark-muted ml-1">({s.stationId})</span>
                  </span>
                  <span className="text-sw-muted dark:text-sw-dark-muted">
                    {s.distanceKm} km &mdash; {(s.weight * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sw-muted dark:text-sw-dark-muted text-xs text-right">
            Data as of {new Date(conditions.observedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
