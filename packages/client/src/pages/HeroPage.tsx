import { useEffect, useState } from 'react';
import { apiFetch, type DemoReading } from '@/lib/api';
import { bearingTo } from '@/lib/geo';
import { compass, fmtSurfRange, isOffshore, M_TO_FT, MPS_TO_KNOTS } from '@/lib/units';
import TriangulationPlan from '@/components/TriangulationPlan';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Caption = ({ children }: { children: React.ReactNode }) => (
  <figcaption className="font-mono text-[10.5px] leading-relaxed text-sw-muted dark:text-sw-dark-muted pt-[7px] max-w-[72ch]">
    {children}
  </figcaption>
);

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-sw-muted dark:text-sw-dark-muted pt-1">
    {children}
  </span>
);

export default function HeroPage() {
  const [demo, setDemo] = useState<DemoReading | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch('/api/demo/conditions')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('unavailable'))))
      .then(setDemo)
      .catch(() => setFailed(true));
  }, []);

  const c = demo?.conditions;
  const spot = demo?.spot;
  const offshore = c && spot ? isOffshore(c.windDirection, spot.facing) : false;
  // The chain's first step names the station that actually carried the reading.
  const lead = c?.sources.reduce((a, b) => (b.weight > a.weight ? b : a));
  // The system the face came from, and the one it beat. Figure 2's middle panel
  // is the partition, so it needs both: the number shown and what it was split
  // away from.
  const driving = c?.faceFrom === 'swell' ? c.swell : c?.faceFrom === 'windWave' ? c.windWave : null;
  const other = c?.faceFrom === 'swell' ? c.windWave : c?.faceFrom === 'windWave' ? c.swell : null;
  const appLink = spot
    ? `/app?lat=${spot.lat}&lon=${spot.lon}&facing=${spot.facing}&label=${encodeURIComponent(spot.label)}`
    : '/app';

  return (
    <div className="min-h-screen bg-sw-bg dark:bg-sw-dark-bg text-sw-strong dark:text-sw-dark-strong font-serif text-[17px] leading-[1.62]">
      <div className="max-w-[880px] mx-auto px-5 pb-16">
        <header className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2.5 pt-5 pb-3.5 border-b border-sw-border dark:border-sw-dark-border">
          <p className="font-mono text-[12.5px] font-semibold uppercase tracking-[0.24em]">
            Swell Engine
          </p>
          <nav className="flex gap-4 font-mono text-[11.5px]">
            <a
              href="#how"
              className="text-sw-muted dark:text-sw-dark-muted hover:text-sw-strong dark:hover:text-sw-dark-strong border-b border-transparent hover:border-sw-blue"
            >
              How it works
            </a>
            <a
              href="#access"
              className="text-sw-muted dark:text-sw-dark-muted hover:text-sw-strong dark:hover:text-sw-dark-strong border-b border-transparent hover:border-sw-blue"
            >
              Access
            </a>
          </nav>
        </header>

        {/* ---- lede ---- */}
        <div className="max-w-[63ch] pt-11 pb-2.5">
          <h1 className="font-serif text-[clamp(38px,6.6vw,58px)] font-semibold leading-[1.04] tracking-[-0.022em] mb-4 max-w-[18ch] text-balance">
            From buoy to barrel.
          </h1>
          <p className="text-[18px] text-sw-text dark:text-sw-dark-text mb-3.5">
            Somewhere offshore a buoy is bobbing around in the dark, taking the ocean&rsquo;s
            measurements every half hour. By the time you&rsquo;re awake, Swell Engine has
            turned them into a straight answer:{' '}
            <strong className="text-sw-strong dark:text-sw-dark-strong font-semibold">
              how big, which way, and whether it&rsquo;s worth the drive.
            </strong>
          </p>
          <p className="text-[18px] text-sw-text dark:text-sw-dark-text">
            Pick a break. Get the number you&rsquo;d actually tell a friend over the phone.
          </p>
        </div>

        {/* ---- figure 1: the live reading ---- */}
        <figure className="mt-6">
          <div className="border border-sw-border dark:border-sw-dark-border grid md:grid-cols-[1fr_250px]">
            {c && spot ? (
              <>
                <div className="px-5 pt-5 pb-4 md:border-r border-b md:border-b-0 border-sw-rule dark:border-sw-dark-rule min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-3">
                    <h2 className="font-cond text-[15px] font-semibold uppercase tracking-[0.04em]">
                      {spot.label}
                    </h2>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-sw-green border border-sw-green px-1.5 py-px">
                      Live
                    </span>
                  </div>
                  <div className="font-mono font-medium tabular-nums leading-[0.84] tracking-[-0.045em] text-[clamp(54px,13vw,80px)] flex items-baseline gap-2.5 flex-wrap">
                    <span>{fmtSurfRange(c.faceHeight, c.faceHeightMax, 'imperial')}</span>
                    <span className="text-[0.26em] tracking-[0.06em] text-sw-muted dark:text-sw-dark-muted">
                      ft
                    </span>
                    <span className="font-cond text-[0.26em] font-bold uppercase tracking-[0.08em] text-sw-amber">
                      {c.tone}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] leading-[1.75] text-sw-muted dark:text-sw-dark-muted mt-3 tabular-nums">
                    Breaking face, trough to crest ·{' '}
                    {c.dominantPeriod?.toFixed(1) ?? '—'}
                    &thinsp;s dominant period
                    <br />
                    Wind {((c.windSpeed ?? 0) * MPS_TO_KNOTS).toFixed(1)}&thinsp;kts from{' '}
                    {c.windDirection ?? '—'}° {compass(c.windDirection)}
                    {spot.facing !== undefined && (
                      <>
                        {' — '}
                        <span className={offshore ? 'text-sw-green' : ''}>
                          {offshore ? 'offshore' : 'onshore'}
                        </span>
                      </>
                    )}
                    <br />
                    {c.sources.length} NDBC stations · observed {fmtTime(c.observedAt)}
                  </p>
                </div>
                <div className="px-3 pt-3.5 pb-1.5">
                  <TriangulationPlan
                    target={{ lat: spot.lat, lon: spot.lon }}
                    sources={c.sources}
                    facing={spot.facing}
                  />
                </div>
              </>
            ) : (
              <div className="px-5 py-8 font-mono text-[12px] text-sw-muted dark:text-sw-dark-muted md:col-span-2">
                {failed
                  ? 'The live reading is unavailable right now. The rest of this page still applies.'
                  : 'Reading the buoys…'}
              </div>
            )}
          </div>
          <Caption>
            <b className="text-sw-text dark:text-sw-dark-text font-medium">Figure 1.</b> This
            morning, live and open to anyone. The plan view places each contributing buoy at its
            true bearing; line weight is its share of the result. The shaded arc is the window of
            swell this break can receive.
          </Caption>
        </figure>

        {/* ---- what you get ---- */}
        <section className="pt-9">
          <div className="max-w-[63ch]">
            <h2 className="font-serif text-[25px] font-semibold leading-tight tracking-[-0.01em] mb-3 max-w-[30ch] text-balance">
              What you get
            </h2>
            <p className="text-sw-text dark:text-sw-dark-text mb-3">
              No dashboard to learn and nothing to configure. Choose a break, or drop in
              coordinates for one nobody has named yet.
            </p>
          </div>
          <ul className="mt-5 max-w-[68ch] list-none p-0">
            {[
              {
                key: 'Wave',
                body: (
                  <>
                    <b>Breaking face height</b>, as a range, the way a surf report is actually
                    spoken — not the offshore figure, which measures a wave in deep water
                    rather than the one you paddle for.
                  </>
                ),
              },
              {
                key: 'Wind',
                body: (
                  <>
                    Speed and direction, and whether it is <b>offshore for that particular
                    break</b>, which is the difference between a clean face and a mess.
                  </>
                ),
              },
              {
                key: 'Tide',
                body: (
                  <>
                    The curve for the next twelve hours with the <b>next high or low</b> called
                    out, from the closest gauge rather than the nearest big harbour.
                  </>
                ),
              },
              {
                key: 'Receipts',
                body: (
                  <>
                    Which buoys answered, how far out they sit, and <b>how much each one
                    counted</b>. If the reading looks wrong you can see why.
                  </>
                ),
              },
            ].map((item, i) => (
              <li
                key={item.key}
                className={`grid sm:grid-cols-[112px_1fr] gap-y-0.5 sm:gap-x-4 py-2.5 ${
                  i > 0 ? 'border-t border-sw-rule dark:border-sw-dark-rule' : ''
                }`}
              >
                <Key>{item.key}</Key>
                <span className="text-[16px] text-sw-text dark:text-sw-dark-text leading-normal [&_b]:text-sw-strong [&_b]:dark:text-sw-dark-strong [&_b]:font-semibold">
                  {item.body}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---- how it works ---- */}
        <section className="pt-9" id="how">
          <div className="max-w-[63ch]">
            <h2 className="font-serif text-[25px] font-semibold leading-tight tracking-[-0.01em] mb-3 max-w-[30ch] text-balance">
              Buoy data is public. The interpretation usually isn&rsquo;t.
            </h2>
            <p className="text-sw-text dark:text-sw-dark-text mb-3">
              NOAA gives the raw measurements away. The step that turns them into a surf report is
              the part that normally sits behind a subscription — so that is the step this does in
              the open.
            </p>
            <p className="text-sw-text dark:text-sw-dark-text">
              A buoy reports{' '}
              <strong className="text-sw-strong dark:text-sw-dark-strong font-semibold">
                significant wave height
              </strong>
              , the average of the highest third, measured in deep water tens of kilometres out. A
              surfer describes the{' '}
              <strong className="text-sw-strong dark:text-sw-dark-strong font-semibold">face</strong>{' '}
              of the wave where it breaks. Those are different numbers, and the gap between them
              depends on period: long groundswell shoals into a much bigger face than wind chop of
              the same height.
            </p>
          </div>

          {c && lead && (
            <figure className="mt-6">
              <div className="border border-sw-border dark:border-sw-dark-border grid sm:grid-cols-3">
                {[
                  {
                    label: 'Measured',
                    val: c.waveHeight?.toFixed(1) ?? '—',
                    unit: 'm offshore',
                    text: `Significant height at buoy ${lead.stationId}, ${lead.distanceKm} km out in deep water.`,
                  },
                  // Reporting the partition rather than an energy index: the index
                  // describes the whole sea at one period, which is the averaging
                  // this step exists to undo.
                  driving && driving.height !== null && driving.period !== null
                    ? {
                        label: 'Partitioned',
                        val: driving.height.toFixed(1),
                        unit: `m @ ${driving.period.toFixed(0)}s`,
                        text:
                          other && other.height !== null && other.period !== null
                            ? `The ${c.faceFrom === 'swell' ? 'groundswell' : 'wind sea'}, separated from ${other.height.toFixed(1)} m at ${other.period.toFixed(0)} s riding on top of it.`
                            : `The ${c.faceFrom === 'swell' ? 'groundswell' : 'wind sea'}, carrying the energy in this reading.`,
                      }
                    : {
                        label: 'Partitioned',
                        val: c.dominantPeriod?.toFixed(0) ?? '—',
                        unit: 's, whole sea',
                        text: 'These stations published no spectral split, so the sea is taken undivided at its dominant period.',
                      },
                  {
                    label: 'Reported',
                    val: fmtSurfRange(c.faceHeight, c.faceHeightMax, 'imperial'),
                    unit: 'ft face',
                    text: 'Breaking height, banded against surf vernacular. Six feet is head high.',
                  },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className={`px-[18px] py-[15px] min-w-0 border-sw-rule dark:border-sw-dark-rule ${
                      i < 2 ? 'sm:border-r border-b sm:border-b-0' : ''
                    }`}
                  >
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-sw-muted dark:text-sw-dark-muted mb-1.5">
                      {s.label}
                    </div>
                    <div className="font-mono text-[27px] font-medium leading-tight tabular-nums tracking-[-0.025em]">
                      {s.val}{' '}
                      <small className="text-[0.44em] text-sw-muted dark:text-sw-dark-muted tracking-[0.04em]">
                        {s.unit}
                      </small>
                    </div>
                    <p className="text-[14px] text-sw-text dark:text-sw-dark-text mt-[7px] leading-normal">
                      {s.text}
                    </p>
                  </div>
                ))}
              </div>
              <Caption>
                <b className="text-sw-text dark:text-sw-dark-text font-medium">Figure 2.</b> One
                sea through all three stages. A buoy measures every wave train at once, so the
                spectrum is split before anything is shoaled — a long groundswell and the chop on
                top of it break at different heights, and averaging them describes neither. Each
                system is then shoaled at its own period by Komar &amp; Gaughan (1972), and the
                larger face is the surf. A range rather than a point, because significant height is
                already a distribution.
              </Caption>
            </figure>
          )}

          {c && spot && (
            <figure className="mt-6">
              <div className="border border-sw-border dark:border-sw-dark-border overflow-x-auto">
                <table className="w-full border-collapse font-mono text-[12px]">
                  <thead>
                    <tr>
                      {['Station', 'Bearing', 'Distance', 'Weight', ''].map((h, i) => (
                        <th
                          key={h || i}
                          className={`font-cond text-[9.5px] uppercase tracking-[0.12em] font-semibold text-sw-muted dark:text-sw-dark-muted pt-2.5 pb-[7px] px-2.5 border-b border-sw-border dark:border-sw-dark-border whitespace-nowrap ${
                            i === 0 ? 'text-left pl-[18px]' : 'text-right'
                          } ${i === 4 ? 'pr-[18px]' : ''}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.sources.map((s, i) => {
                      const brg = bearingTo({ lat: spot.lat, lon: spot.lon }, s);
                      const last = i === c.sources.length - 1;
                      const cell = `py-[9px] px-2.5 tabular-nums align-middle ${
                        last ? '' : 'border-b border-sw-rule dark:border-sw-dark-rule'
                      }`;
                      return (
                        <tr key={s.stationId}>
                          <td className={`${cell} pl-[18px] text-left`}>
                            <span className="font-medium">{s.stationId}</span>{' '}
                            <span className="font-cond text-[12.5px] text-sw-muted dark:text-sw-dark-muted">
                              {s.stationName}
                            </span>
                          </td>
                          <td className={`${cell} text-right`}>
                            {brg.toFixed(0)}° {compass(brg)}
                          </td>
                          <td className={`${cell} text-right`}>{s.distanceKm} km</td>
                          <td className={`${cell} text-right`}>{s.weight.toFixed(3)}</td>
                          <td className={`${cell} pr-[18px] w-[86px]`}>
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
              <Caption>
                <b className="text-sw-text dark:text-sw-dark-text font-medium">Figure 3.</b> The
                stations behind Figure 1. Weighting falls off with the square of distance and
                narrows toward the directions the break faces, so the most distant station is
                present for completeness rather than influence.
              </Caption>
            </figure>
          )}
        </section>

        {/* ---- access ---- */}
        <section className="pt-10 max-w-[63ch]" id="access">
          <h2 className="font-serif text-[25px] font-semibold leading-tight tracking-[-0.01em] mb-3 max-w-[30ch] text-balance">
            Open by invitation while the model settles
          </h2>
          <p className="text-sw-text dark:text-sw-dark-text">
            Full access needs a key for now, while the numbers get checked against real sessions.
            The reading above is live and needs nothing at all. Coverage is US mainland breaks, in
            face height — not the Hawaiian scale.
          </p>
          <div className="flex gap-2.5 flex-wrap mt-4.5">
            <a
              href={appLink}
              className="font-cond text-[13px] font-semibold tracking-[0.06em] uppercase px-4 py-2.5 bg-sw-blue text-sw-bg dark:text-sw-dark-bg border border-sw-blue hover:opacity-85 transition-opacity"
            >
              See a break
            </a>
            <a
              href="#access"
              className="font-cond text-[13px] font-semibold tracking-[0.06em] uppercase px-4 py-2.5 border border-sw-blue text-sw-blue hover:opacity-85 transition-opacity"
            >
              Ask for a key
            </a>
          </div>
        </section>

        <footer className="mt-11 pt-3.5 border-t border-sw-border dark:border-sw-dark-border font-mono text-[10.5px] leading-[1.8] text-sw-muted dark:text-sw-dark-muted flex flex-wrap gap-x-6 gap-y-1 justify-between">
          <span>
            Measurements from{' '}
            <b className="text-sw-text dark:text-sw-dark-text font-medium">NOAA NDBC</b>; tides from{' '}
            <b className="text-sw-text dark:text-sw-dark-text font-medium">NOAA CO-OPS</b>. Public
            domain.
          </span>
          <span>Not a substitute for judgement in the water.</span>
        </footer>
      </div>
    </div>
  );
}
