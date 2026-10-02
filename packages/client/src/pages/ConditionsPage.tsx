import { useEffect, useRef, useState } from 'react';
import { validateLat, validateLon } from '@/lib/validateCoords';
import { PRESETS } from '@/lib/presets';
import { apiFetch, type Conditions, type Tide } from '@/lib/api';
import { readSpotFromUrl, writeSpotToUrl } from '@/lib/spotUrl';
import { useUnits } from '@/lib/useUnits';
import {
  compass,
  fmtDistance,
  fmtHeight,
  fmtPeriod,
  fmtSpeed,
  fmtSurfRange,
  fmtTemp,
  isOffshore,
  surfUnit,
} from '@/lib/units';
import ThemeToggle from '@/components/ThemeToggle';
import TideStrip from '@/components/TideStrip';
import TriangulationPlan, { bearingTo } from '@/components/TriangulationPlan';

const TONE_COLORS: Record<string, string> = {
  flat: 'text-sw-muted dark:text-sw-dark-muted',
  small: 'text-sw-blue',
  solid: 'text-sw-green',
  large: 'text-sw-amber',
  xl: 'text-sw-amber',
  xxl: 'text-sw-red',
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Cap = ({ children }: { children: React.ReactNode }) => (
  <div className="font-cond text-[10px] uppercase tracking-[0.14em] font-semibold text-sw-muted dark:text-sw-dark-muted">
    {children}
  </div>
);

export default function ConditionsPage() {
  const { units, setUnits } = useUnits();

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const [facing, setFacing] = useState<number | undefined>(undefined);

  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [tide, setTide] = useState<Tide | null>(null);
  const [latError, setLatError] = useState<string | null>(null);
  const [lonError, setLonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (
    latVal: string,
    lonVal: string,
    facingVal?: number,
    labelVal?: string,
  ) => {
    setLat(latVal);
    setLon(lonVal);
    setFacing(facingVal);
    setLabel(labelVal ?? null);
    setLatError(null);
    setLonError(null);
    setLoading(true);
    setError(null);
    setConditions(null);
    setTide(null);
    writeSpotToUrl({ lat: latVal, lon: lonVal, facing: facingVal, label: labelVal });

    // Tide is supplementary and fails on its own terms — no station within
    // range, or NOAA being down — so it resolves separately and simply goes
    // missing rather than failing the lookup.
    const tideParams = new URLSearchParams({ lat: latVal, lon: lonVal });
    apiFetch(`/api/tide?${tideParams}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setTide)
      .catch(() => setTide(null));

    try {
      const params = new URLSearchParams({ lat: latVal, lon: lonVal });
      if (facingVal !== undefined) params.set('facing', String(facingVal));
      const res = await apiFetch(`/api/buoy/conditions?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Request failed');
      setConditions(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // A shared link opens on real data rather than an empty form.
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current) return;
    openedFromUrl.current = true;
    const spot = readSpotFromUrl();
    if (spot) void lookup(spot.lat, spot.lon, spot.facing, spot.label);
  }, []);

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setGeolocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocating(false);
        void lookup(pos.coords.latitude.toFixed(4), pos.coords.longitude.toFixed(4));
      },
      () => {
        setError('Location access denied or unavailable');
        setGeolocating(false);
      },
    );
  };

  const busy = loading || geolocating;
  const offshore = conditions ? isOffshore(conditions.windDirection, facing) : false;

  const unitBtn = (value: 'imperial' | 'metric', text: string) => (
    <button
      onClick={() => setUnits(value)}
      aria-pressed={units === value}
      className={`font-mono text-[10px] uppercase tracking-[0.08em] border px-2 py-0.5 leading-snug transition-colors ${
        units === value
          ? 'bg-sw-text dark:bg-sw-dark-muted text-sw-bg dark:text-sw-dark-bg border-sw-text dark:border-sw-dark-muted'
          : 'border-sw-border dark:border-sw-dark-border text-sw-muted dark:text-sw-dark-muted hover:text-sw-strong dark:hover:text-sw-dark-strong'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="min-h-screen bg-sw-bg dark:bg-sw-dark-bg text-sw-strong dark:text-sw-dark-strong font-cond">
      <div className="max-w-[880px] mx-auto px-4 py-7 pb-14">
        <div className="border border-sw-border dark:border-sw-dark-border">
          {/* ---- title block ---- */}
          <header className="flex flex-wrap items-end justify-between gap-3.5 px-4 pt-3.5 pb-3 border-b-2 border-sw-strong dark:border-sw-dark-strong">
            <div>
              <p className="font-mono text-[13px] font-semibold uppercase tracking-[0.22em] mb-0.5">
                Swell Engine
              </p>
              <h1 className="text-[26px] font-bold leading-none tracking-tight">
                {label ?? (conditions ? 'Custom position' : 'Pick a break')}
                {facing !== undefined && (
                  <span className="text-sw-muted dark:text-sw-dark-muted font-medium text-[15px] tracking-normal">
                    {' '}
                    / faces {facing}°
                  </span>
                )}
              </h1>
            </div>
            <div className="font-mono text-[11px] leading-[1.7] text-sw-text dark:text-sw-dark-text tabular-nums sm:text-right">
              {conditions ? (
                <>
                  {Math.abs(Number(lat)).toFixed(4)}
                  {Number(lat) >= 0 ? ' N' : ' S'} &nbsp;{' '}
                  {Math.abs(Number(lon)).toFixed(4)}
                  {Number(lon) >= 0 ? ' E' : ' W'}
                  <br />
                  Triangulated from{' '}
                  <span className="text-sw-strong dark:text-sw-dark-strong">
                    {conditions.sources.length}
                  </span>{' '}
                  NDBC stations
                  <br />
                  Observed{' '}
                  <span className="text-sw-strong dark:text-sw-dark-strong">
                    {fmtTime(conditions.observedAt)}
                  </span>
                </>
              ) : (
                <>
                  NOAA NDBC buoys, inverse distance
                  <br />
                  Heights are breaking face, MLLW tide
                </>
              )}
              <div className="flex gap-1.5 mt-1.5 sm:justify-end">
                {unitBtn('metric', 'Metric')}
                {unitBtn('imperial', 'Feet')}
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* ---- spot picker ---- */}
          <section className="px-4 py-3 border-b border-sw-border dark:border-sw-dark-border">
            <Cap>Break</Cap>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => void lookup(String(p.lat), String(p.lon), p.facing, p.label)}
                  disabled={busy}
                  className={`font-mono text-[11px] border px-2 py-1 transition-colors disabled:opacity-40 ${
                    label === p.label
                      ? 'border-sw-blue text-sw-blue'
                      : 'border-sw-border dark:border-sw-dark-border text-sw-text dark:text-sw-dark-text hover:border-sw-muted dark:hover:border-sw-dark-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-2.5 items-start">
              <div className="flex flex-col gap-0.5">
                <input
                  id="lat"
                  type="text"
                  placeholder="Latitude"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  onBlur={() => setLatError(validateLat(lat))}
                  className={`font-mono text-[12px] tabular-nums bg-transparent border px-2 py-1 w-28 focus:outline-none focus:border-sw-blue placeholder:text-sw-muted dark:placeholder:text-sw-dark-muted ${
                    latError ? 'border-sw-red' : 'border-sw-border dark:border-sw-dark-border'
                  }`}
                />
                {latError && <span className="text-sw-red text-[10px] font-mono">{latError}</span>}
              </div>
              <div className="flex flex-col gap-0.5">
                <input
                  id="lon"
                  type="text"
                  placeholder="Longitude"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  onBlur={() => setLonError(validateLon(lon))}
                  className={`font-mono text-[12px] tabular-nums bg-transparent border px-2 py-1 w-28 focus:outline-none focus:border-sw-blue placeholder:text-sw-muted dark:placeholder:text-sw-dark-muted ${
                    lonError ? 'border-sw-red' : 'border-sw-border dark:border-sw-dark-border'
                  }`}
                />
                {lonError && <span className="text-sw-red text-[10px] font-mono">{lonError}</span>}
              </div>
              <button
                onClick={() => void lookup(lat, lon)}
                disabled={busy || !lat || !lon || !!latError || !!lonError}
                className="font-mono text-[11px] uppercase tracking-[0.08em] bg-sw-blue text-white px-3 py-1.5 disabled:opacity-40 hover:bg-[#2580B8] transition-colors"
              >
                {loading ? 'Reading…' : 'Read'}
              </button>
              <button
                onClick={handleGeolocate}
                disabled={busy}
                className="font-mono text-[11px] uppercase tracking-[0.08em] border border-sw-border dark:border-sw-dark-border text-sw-text dark:text-sw-dark-text px-3 py-1.5 disabled:opacity-40 hover:border-sw-muted dark:hover:border-sw-dark-muted transition-colors"
              >
                {geolocating ? 'Locating…' : 'Use my location'}
              </button>
            </div>
          </section>

          {error && (
            <div className="px-4 py-3 border-b border-sw-border dark:border-sw-dark-border font-mono text-[12px] text-sw-red">
              {error}
            </div>
          )}

          {!conditions && !error && (
            <div className="px-4 py-8 font-mono text-[12px] text-sw-muted dark:text-sw-dark-muted">
              {loading
                ? 'Reading buoys…'
                : 'Choose a break above, enter coordinates, or use your location.'}
            </div>
          )}

          {conditions && (
            <>
              {/* ---- primary readout ---- */}
              {conditions.faceHeight === null ? (
                // The model returns 'flat' for a null height, which is the safe
                // default but the wrong thing to show: absence of a measurement
                // is not calm surf. Say which it is.
                <section className="px-4 pt-5 pb-4 border-b border-sw-border dark:border-sw-dark-border">
                  <Cap>Breaking face</Cap>
                  <div className="font-mono text-[22px] font-medium mt-0.5">No wave data</div>
                  <p className="font-mono text-[11px] text-sw-muted dark:text-sw-dark-muted mt-1">
                    {conditions.sources.length} station
                    {conditions.sources.length === 1 ? '' : 's'} reporting, none with wave height.
                    NDBC marks a missing field MM — the buoy is up, the sensor is not.
                  </p>
                </section>
              ) : (
                <section className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] items-end gap-x-6 gap-y-1.5 px-4 pt-5 pb-4 border-b border-sw-border dark:border-sw-dark-border">
                  <div>
                    <Cap>Breaking face</Cap>
                    <div className="font-mono font-medium tabular-nums leading-[0.86] tracking-[-0.04em] text-[clamp(52px,13vw,78px)]">
                      {fmtSurfRange(conditions.faceHeight, conditions.faceHeightMax, units)}
                      <span className="text-[0.3em] tracking-[0.06em] text-sw-muted dark:text-sw-dark-muted ml-[0.12em]">
                        {surfUnit(units)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Cap>Dominant period</Cap>
                    <div className="font-mono text-[28px] font-medium tabular-nums leading-none tracking-tight">
                      {fmtPeriod(conditions.dominantPeriod)}
                      <span className="text-[0.45em] text-sw-muted dark:text-sw-dark-muted tracking-[0.06em]">
                        s
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Cap>Condition</Cap>
                    <div
                      className={`font-mono text-[19px] font-semibold uppercase tracking-[0.06em] leading-none ${
                        TONE_COLORS[conditions.tone] ?? ''
                      }`}
                    >
                      {conditions.tone}
                    </div>
                  </div>
                </section>
              )}

              {/* ---- ruled metrics ---- */}
              <section className="grid grid-cols-2 sm:grid-cols-4 border-b border-sw-border dark:border-sw-dark-border">
                {[
                  {
                    cap: 'Wind',
                    val: fmtSpeed(conditions.windSpeed, units),
                    sub: (
                      <>
                        from {conditions.windDirection ?? '—'}° {compass(conditions.windDirection)}
                        {facing !== undefined && (
                          <>
                            {' · '}
                            <span className={offshore ? 'text-sw-green font-semibold' : ''}>
                              {offshore ? 'offshore' : 'onshore'}
                            </span>
                          </>
                        )}
                      </>
                    ),
                  },
                  {
                    cap: 'Water',
                    val: fmtTemp(conditions.waterTemp, units),
                    sub: 'surface temperature',
                  },
                  {
                    cap: 'Offshore swell',
                    val: fmtHeight(conditions.waveHeight, units),
                    sub: 'significant height at the buoy',
                  },
                  {
                    cap: 'Swell power',
                    val:
                      conditions.swellPower === null
                        ? '—'
                        : conditions.swellPower.toFixed(1),
                    sub: 'H²·T, feeds the face estimate',
                  },
                ].map((m, i) => (
                  <div
                    key={m.cap}
                    className={`px-4 py-2.5 min-w-0 border-sw-rule dark:border-sw-dark-rule ${
                      i < 3 ? 'sm:border-r' : ''
                    } ${i % 2 === 0 ? 'border-r' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''}`}
                  >
                    <Cap>{m.cap}</Cap>
                    <div className="font-mono text-[17px] font-medium tabular-nums tracking-tight">
                      {m.val}
                    </div>
                    <div className="font-mono text-[11px] text-sw-muted dark:text-sw-dark-muted mt-px">
                      {m.sub}
                    </div>
                  </div>
                ))}
              </section>

              {/* ---- triangulation ---- */}
              <div className="flex items-baseline justify-between gap-3 flex-wrap px-4 pt-3 pb-2 border-b border-sw-rule dark:border-sw-dark-rule">
                <h2 className="font-cond text-[11px] uppercase tracking-[0.14em] font-bold">
                  Source triangulation
                </h2>
                <p className="font-mono text-[10.5px] text-sw-muted dark:text-sw-dark-muted text-right">
                  Inverse distance, 1/d²
                  {facing !== undefined && ' · weighted toward the swell window'}
                </p>
              </div>
              <section className="grid lg:grid-cols-[300px_1fr] border-b border-sw-border dark:border-sw-dark-border">
                <div className="px-4 pt-3.5 pb-2 lg:border-r border-b lg:border-b-0 border-sw-rule dark:border-sw-dark-rule">
                  <TriangulationPlan
                    target={{ lat: Number(lat), lon: Number(lon) }}
                    sources={conditions.sources}
                    facing={facing}
                  />
                </div>
                <div className="min-w-0 overflow-x-auto">
                  <table className="w-full border-collapse font-mono text-[12px]">
                    <thead>
                      <tr>
                        {['Station', 'Bearing', 'Distance', 'Weight', ''].map((h, i) => (
                          <th
                            key={h || i}
                            className={`font-cond text-[9.5px] uppercase tracking-[0.12em] font-semibold text-sw-muted dark:text-sw-dark-muted pt-2.5 pb-1.5 px-2.5 border-b border-sw-border dark:border-sw-dark-border whitespace-nowrap ${
                              i === 0 ? 'text-left pl-4' : 'text-right'
                            } ${i === 4 ? 'pr-4' : ''}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {conditions.sources.map((s) => {
                        const brg = bearingTo({ lat: Number(lat), lon: Number(lon) }, s);
                        return (
                          <tr key={s.stationId}>
                            <td className="py-2 px-2.5 pl-4 border-b border-sw-rule dark:border-sw-dark-rule align-middle">
                              <span className="text-sw-strong dark:text-sw-dark-strong font-medium">
                                {s.stationId}
                              </span>
                              <br />
                              <span className="font-cond text-[12.5px] text-sw-muted dark:text-sw-dark-muted">
                                {s.stationName}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-right tabular-nums border-b border-sw-rule dark:border-sw-dark-rule align-middle">
                              {brg.toFixed(0)}° {compass(brg)}
                            </td>
                            <td className="py-2 px-2.5 text-right tabular-nums border-b border-sw-rule dark:border-sw-dark-rule align-middle">
                              {fmtDistance(s.distanceKm, units)}
                            </td>
                            <td className="py-2 px-2.5 text-right tabular-nums border-b border-sw-rule dark:border-sw-dark-rule align-middle">
                              {s.weight.toFixed(3)}
                            </td>
                            <td className="py-2 px-2.5 pr-4 w-[92px] border-b border-sw-rule dark:border-sw-dark-rule align-middle">
                              <div
                                className="h-[7px] bg-sw-blue min-w-px"
                                style={{ width: `${(s.weight * 100).toFixed(1)}%` }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {tide && <TideStrip tide={tide} units={units} />}

              <footer className="flex flex-wrap gap-y-1 gap-x-6 justify-between px-4 pt-2.5 pb-3 font-mono text-[10.5px] leading-[1.75] text-sw-muted dark:text-sw-dark-muted tabular-nums">
                <span>
                  Observed{' '}
                  <span className="text-sw-text dark:text-sw-dark-text">
                    {fmtTime(conditions.observedAt)}
                  </span>{' '}
                  · generated{' '}
                  <span className="text-sw-text dark:text-sw-dark-text">
                    {fmtTime(conditions.generatedAt)}
                  </span>
                </span>
                <span>
                  Face height, trough to crest · tide relative to{' '}
                  <span className="text-sw-text dark:text-sw-dark-text">MLLW</span> · bearings
                  degrees true
                </span>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
