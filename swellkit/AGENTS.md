# swellkit

The surf model: buoy observations in, an actionable forecast out. Everything
else in this repository — the Fastify API, the React client, the NDBC and tide
pipelines — is delivery. This package is the part that has to get *good*.

## What this package is for

The current model is deliberately crude: inverse-distance weighting across the
three nearest buoys, and a power index of H²×T. It is a faithful port of the
TypeScript original and produces identical output by design. That is the
starting line, not the destination.

The reason this exists in Python is access to the scientific ecosystem. Do not
reimplement spectral analysis, harmonic tidal fitting, or geospatial projection
by hand. Reach for the library.

## Conventions and traps

These cost hours if you get them wrong, and nothing in the code will stop you.

- **Wave direction is whence the swell comes**, not where it travels. A 270°
  reading means swell arriving *from* the west. Directional weighting compares
  this against the direction the break faces, and both use the same convention.
- **Bearings are degrees true**, 0–360, and **cannot be averaged**. The mean of
  355° and 5° is 0°, not 180°. `triangulate` sidesteps this by taking wind
  direction from the single most influential buoy rather than blending. If you
  ever need a real directional mean, decompose into vector components.
- **Null is not zero.** A missing instrument reading means "unknown", and a
  forecast that treats it as 0 will report flat conditions rather than no data.
  Every nullable field in the contract is nullable for this reason.
- **Tide is relative to MLLW** (mean lower low water) and **goes negative**
  several times a year. It is an average of lower lows, not a floor.
- **NDBC uses `MM` as its missing-value sentinel** in the fixed-width text
  files, not an empty field and not `-999`.
- **Units are SI throughout the contract**: metres, seconds, m/s, °C. Feet and
  knots exist only for display, and only in the client. The one exception is
  `classify_tone`, whose thresholds are in feet for surf-reporting convention —
  that conversion lives inside the model and must stay there.
- **Significant wave height** (`WVHT`) is roughly the mean of the highest third
  of waves, not the largest wave and not the average. Individual waves reach
  well above it.
- **Breaking height is not offshore height.** Shoaling and refraction transform
  a swell as it reaches the bathymetry of a specific break. The current model
  ignores this entirely.

## Data sources

**NDBC realtime** — `https://www.ndbc.noaa.gov/data/realtime2/<station>.txt`.
Fixed-width, newest row first, two header rows. Parsed today in
`packages/server/src/modules/buoy/ndbcClient.ts`, which reads only the summary
fields.

**NDBC spectral** — the same station publishes far more than the summary. The
`.spec`, `.swden`, and `.swdir` files carry spectral wave density and
directional moments. **This is the largest available accuracy gain and it is
not yet used.** A single `dominantPeriod` averaged across three buoys smears a
clean 16-second groundswell together with local wind chop; the spectrum
separates them.

**NOAA CO-OPS** — tide predictions, already integrated. Note that the
continuous 30-minute series exists only for *reference* stations; the 2,243
*subordinate* stations (of 3,499 total) publish high/low events only. The curve
is reconstructed by half-cosine interpolation between extremes, which is why
`packages/shared/src/tide.ts` exists.

**WAVEWATCH III** — NOAA's operational spectral wave model, gridded, free, and
**the missing half of the product**. The app currently reports conditions *now*
and can say nothing about tomorrow. Ships as GRIB2.

**Bathymetry** — GEBCO and NOAA coastal relief grids, for refraction and
shoaling.

## Libraries to reach for

| need | use |
|---|---|
| arrays, FFT, signal processing | `numpy`, `scipy.signal` |
| labelled N-dimensional grids | `xarray` |
| wave spectra | `wavespectra` |
| NetCDF / HDF5 | `netCDF4`, `h5py` |
| GRIB2 (WAVEWATCH III) | `cfgrib` — needs the eccodes C library |
| tidal harmonic analysis | `utide` |
| projections, geodesy | `pyproj` |
| seawater thermodynamics | `gsw` |

`cfgrib` is the one that may force a toolchain change. Everything above it
installs cleanly from PyPI under uv; eccodes has C dependencies that
conda-forge handles more gracefully. If GRIB work turns painful, `pixi` over
conda-forge is the escape hatch — it is a dependency-file rewrite, not a port.

## Physics versus fitted coefficients

Keep these separate, because they have different evidentiary standards.

**Physics** is derivable and testable without users: spectral decomposition,
group velocity and travel time, refraction over known bathymetry. Improvements
here can be justified from first principles and validated against published
model output.

**Fitted coefficients** are tuned to observed outcomes. `HIGH_POWER_THRESHOLD =
16` is currently a guess, not a fit. Do **not** invent or adjust such constants
to make output look better — there is no ground truth yet to fit against.
Document any such value as provisional and say what data would justify it.
Calibration becomes possible once real surfer feedback is paired with
observations; until then, prefer physics that needs no tuning.

## Validation

**Equivalence first.** `tests/test_equivalence.py` asserts this port reproduces
the TypeScript model exactly across 128 captured fixtures. Those fixtures are a
baseline, not a convenience: regenerate them only when the TypeScript model
changes on purpose, never to make a failing test pass. Once the two agree, any
later difference in output is attributable to new physics rather than a
translation bug.

**Then properties.** Physical invariants hold regardless of coefficients:
output within the range of its inputs, no overshoot past the extremes,
monotonic response to monotonic input, null in yields null out, and a weight set
that sums to one. These catch what fixtures cannot.

**Cross-language numerics.** Achieving equivalence surfaced four hazards, all of
which look like physics errors when they fail:

- `Math.round` breaks ties upward; Python's `round` breaks to even. See
  `_js_round`.
- `toFixed` rounds likewise. See `_js_fixed`.
- `math.radians(x)` multiplies by a precomputed pi/180, where the reference
  computes `(x * pi) / 180`. Different last bit. See `_to_rad` — this alone
  accounted for 42 of 128 fixtures.
- `x**2` and `x * x` disagree for some doubles in Python (251 in 200,000
  sampled), while JS engines fold `**2` into a multiply. Always write the
  multiply.

`cos` is the one that cannot be fixed: it is not bit-reproducible across
runtimes, so 2 of 128 fixtures differ by about one unit in the last place. That
is why the equivalence test uses `rel=1e-15` rather than exact equality. Keep
that tolerance tight — it is sized for transcendentals, not for sloppiness.

## The contract

`../contract.schema.json` is the source of truth, shared with the TypeScript
side. Output must be JSON-serialisable: no `datetime` objects, no numpy scalars
(call `.item()` or `float()`), no NaN or Infinity — JSON cannot represent them
and a NaN that reaches `classify_tone` fails every comparison and silently
returns `xxl`, the largest possible surf. That bug was real; it is what the
`total == 0` guard in `_weighted_mean` prevents.

Changing the contract means changing the schema, both implementations, and the
fixtures, in one commit.

## Running things

```bash
uv sync                                    # once uv is installed
uv run pytest                              # equivalence and property tests
uv run ruff check .                        # lint
echo '{...}' | uv run python -m swellkit   # the process boundary
```

Phase 1 has no dependencies, so a bare `PYTHONPATH=src python3 -m swellkit`
works too.

## Boundaries

This package does not know about HTTP, Postgres, Redis, station names, or
authentication. It takes a `ForecastRequest` and returns a `Forecast`. If
something here needs to fetch, cache, or persist, it belongs in the server
instead — keeping this package pure is what allows it to be extracted into its
own private repository later without untangling anything.
