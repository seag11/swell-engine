"""Blending buoy observations into a reading for a point."""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from datetime import UTC, datetime

from .contract import (
    BuoyObservation,
    ObservationWeight,
    Reading,
    ReadingRequest,
    SystemKind,
    WaveSystem,
)
from .surf import breaking_height, classify_tone, compute_swell_power, highest_tenth

EARTH_RADIUS_KM = 6371.0

# How many observations the blend expects. Callers select the candidates.
OBSERVATION_LIMIT = 3


def _to_rad(degrees: float) -> float:
    """Degrees to radians, multiplying before dividing.

    Not `math.radians`, which multiplies by a precomputed pi/180 and therefore
    rounds differently in the last bit. Matching the reference implementation's
    order keeps the fixtures exact, so they still detect drift at full precision.
    """
    return (degrees * math.pi) / 180


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Equirectangular approximation.

    Cheaper than haversine and accurate to well under a percent at the distances
    between a break and its nearby buoys.
    """
    x = _to_rad(lon2 - lon1) * math.cos(_to_rad((lat1 + lat2) / 2))
    y = _to_rad(lat2 - lat1)
    return EARTH_RADIUS_KM * math.sqrt(x * x + y * y)


def _weighted_mean(
    samples: Sequence[tuple[float | None, float]]
) -> float | None:
    present = [(v, w) for v, w in samples if v is not None]
    if not present:
        return None
    # Plain summation, matching the reference implementation's reduce order.
    # fsum would be marginally more accurate but differ in the last bit,
    # which would blunt the fixtures as a drift detector.
    total = sum(w for _, w in present)
    # Every contributing weight can be zero once directional clamping applies.
    # Dividing here would yield NaN, which then fails every comparison in
    # classify_tone and silently reports the largest possible surf.
    if total == 0:
        return None
    return sum(v * w / total for v, w in present)


def _dominant[T](samples: Sequence[tuple[T | None, float]]) -> T | None:
    """The value from the heaviest observation that reported one.

    For quantities that cannot be averaged. Bearings wrap at 0/360, so the mean
    of 355 and 5 is 0 rather than 180, and a steepness category is a label with
    no midpoint. The most influential station speaks for the set instead.

    Stations that reported nothing are skipped rather than vetoing the field, so
    a gap at the nearest buoy falls through to the next.
    """
    present = [(v, w) for v, w in samples if v is not None]
    if not present:
        return None
    return max(present, key=lambda vw: vw[1])[0]


def _parse_iso_ms(value: str) -> int:
    return round(
        datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000
    )


def _format_iso_ms(ms: int) -> str:
    """Render as JavaScript's toISOString does: always milliseconds, always Z."""
    dt = datetime.fromtimestamp(ms / 1000, tz=UTC)
    return f"{dt:%Y-%m-%dT%H:%M:%S}.{dt.microsecond // 1000:03d}Z"


def _js_round(value: float) -> int:
    """Match JavaScript's Math.round, which breaks ties upward rather than
    to even as Python's built-in round does."""
    return math.floor(value + 0.5)


def _js_fixed(value: float, digits: int) -> float:
    """Match parseFloat(value.toFixed(digits))."""
    return float(f"{value:.{digits}f}")


def _rescale_to_total(
    systems: Sequence[WaveSystem | None], wave_height: float | None
) -> list[WaveSystem | None]:
    """Put the partition heights on the scale of the blended sea.

    Partitions are blended only over the stations that published them, while
    `wave_height` is blended over all of them. When those sets differ the two
    views disagree, and the disagreement is not small: at a New Jersey break the
    nearest buoy publishes no partition and reads 1.2m, its distant neighbour
    publishes one and reads 1.6m, so the unscaled partition reports a third more
    surf than the sea it came from.

    The fix is an identity the data already satisfies rather than a correction
    invented here. Systems are energy-complementary and energy goes as the
    square, so their heights combine in quadrature: every station's SwH and WWH
    reproduce its WVHT to within the tenth of a metre the files are rounded to.
    Scaling the set so that identity holds against the blended total therefore
    takes magnitude from every station and spectral shape — the energy split and
    the periods — only from those that reported it.

    The assumption is that shape varies more smoothly across a buoy set than
    amplitude does, which is why the shape may be borrowed from a neighbour
    while the height may not. Two swells crossing in a small area would break
    it; nothing here can yet detect that.

    Does nothing without a total to scale against, since the alternative is
    inventing one.
    """
    if wave_height is None:
        return list(systems)

    energy = sum(s.height * s.height for s in systems if s and s.height is not None)
    if energy == 0:
        return list(systems)

    scale = wave_height / math.sqrt(energy)
    return [
        s
        if s is None or s.height is None
        else WaveSystem(
            height=s.height * scale, period=s.period, direction=s.direction
        )
        for s in systems
    ]


def _pick_face(
    swell: WaveSystem | None,
    wind_wave: WaveSystem | None,
    wave_height: float | None,
    dominant_period: float | None,
) -> tuple[float | None, SystemKind | None]:
    """Shoal each system at its own period and keep the larger face.

    A partitioned sea is never shoaled as a whole. That was the smear this
    replaces: one dominant period stood in for both a groundswell and the chop
    riding on it, so a 0.3m 14s forerunner under a 1.6m 5s sea came out as a
    single mid-period wave that existed nowhere in the water.

    Short-period wind sea is not discarded. Two metres at eight seconds is
    rideable, if textured, and throwing it away would under-report a beach break
    living off wind swell. The comparison stays fair because Komar & Gaughan
    already penalises steepness: a sea that is whitecapping offshore shoals to a
    face at or below its deepwater height, while long-period swell amplifies.

    Falls back to the undecomposed sea only when no station in the set published
    a partition, since reintroducing it alongside partitions would reintroduce
    the smear.
    """
    candidates: list[tuple[SystemKind, float]] = []
    for kind, system in (("swell", swell), ("windWave", wind_wave)):
        if system is None or system.is_empty:
            continue
        face = breaking_height(system.height, system.period)
        if face is not None:
            candidates.append((kind, face))

    if candidates:
        kind, face = max(candidates, key=lambda c: c[1])
        return face, kind

    total = breaking_height(wave_height, dominant_period)
    return total, "total" if total is not None else None


def triangulate(request: ReadingRequest) -> Reading:
    """Inverse-distance weighting, optionally narrowed by which way the break faces.

    Distance weights go as 1/d^2, so a buoy twice as far contributes a quarter as
    much. When ``facing`` is given, each observation is additionally scaled by
    the cosine of the angle between its swell direction and the break, clamped at
    zero: swell arriving from behind the headland is not relevant to this break.

    If every directional weight clamps to zero there is no relevant swell in the
    set, and the blend falls back to distance alone rather than returning nothing.

    Each wave system is weighted on its own direction. A groundswell from the
    northwest and a wind sea from the south are not equally relevant to a
    west-facing break, and before partitioning there was only one direction to
    judge them both by.
    """
    observations = request.observations
    facing = request.facing

    distances = [
        _distance_km(request.target_lat, request.target_lon, o.lat, o.lon)
        for o in observations
    ]
    # d * d rather than d**2: Python's pow and multiplication disagree in the
    # last bit for some doubles, where JS engines fold **2 into a multiply.
    by_distance = [1 / (d * d) for d in distances]

    def weights_for(bearings: Sequence[float | None]) -> list[float]:
        """Distance weights narrowed by whether waves from these bearings arrive."""
        by_direction = [
            max(0.0, math.cos(_to_rad(b - facing)))
            if facing is not None and b is not None
            else 1.0
            for b in bearings
        ]
        # strict=True throughout: these lists are all per-observation, so a
        # length mismatch is a bug rather than something to silently truncate.
        combined = [d * dir_ for d, dir_ in zip(by_distance, by_direction, strict=True)]
        return combined if sum(combined) > 0 else by_distance

    # The undecomposed sea, judged on mean wave direction as before. Still the
    # audit trail and still the only height a station without a .spec file gives.
    sea_weights = weights_for([o.wave_direction for o in observations])
    total_weight = sum(sea_weights)

    def sea_field(attr: str) -> float | None:
        return _weighted_mean(
            [
                (getattr(o, attr), w)
                for o, w in zip(observations, sea_weights, strict=True)
            ]
        )

    def blend_system(
        select: Callable[[BuoyObservation], WaveSystem | None],
    ) -> WaveSystem | None:
        """One partition, blended over the stations that published it.

        Stations with no partition data abstain rather than block: three of the
        seeded stations publish a .spec file whose partition columns are all MM,
        and one of them is the nearest buoy to a preset break. Treating that as
        "no partitions anywhere" would throw away good data from its neighbours.

        Heights come out on the reporting stations' scale, which is not the
        scale of the blended sea when those stations are the distant ones. See
        `_rescale_to_total`, which puts them back.
        """
        systems = [
            s if (s := select(o)) is not None and not s.is_empty else None
            for o in observations
        ]
        if all(s is None for s in systems):
            return None

        weights = weights_for([s.direction if s else None for s in systems])
        paired = list(zip(systems, weights, strict=True))
        return WaveSystem(
            height=_weighted_mean([(s.height if s else None, w) for s, w in paired]),
            period=_weighted_mean([(s.period if s else None, w) for s, w in paired]),
            direction=_dominant([(s.direction if s else None, w) for s, w in paired]),
        )

    wave_height = sea_field("wave_height")
    dominant_period = sea_field("dominant_period")
    swell, wind_wave = _rescale_to_total(
        [blend_system(lambda o: o.swell), blend_system(lambda o: o.wind_wave)],
        wave_height,
    )

    face, face_from = _pick_face(swell, wind_wave, wave_height, dominant_period)

    observation_weights = [
        ObservationWeight(
            station_id=o.station_id,
            distance_km=_js_round(d),
            weight=_js_fixed(w / total_weight, 3),
        )
        for o, d, w in zip(observations, distances, sea_weights, strict=True)
    ]

    observed_at = _format_iso_ms(
        min(_parse_iso_ms(o.observed_at) for o in observations)
    )

    return Reading(
        wave_height=wave_height,
        dominant_period=dominant_period,
        swell_power=compute_swell_power(wave_height, dominant_period),
        face_height=face,
        face_height_max=highest_tenth(face),
        face_from=face_from,
        swell=swell,
        wind_wave=wind_wave,
        steepness=_dominant(
            [(o.steepness, w) for o, w in zip(observations, sea_weights, strict=True)]
        ),
        wind_speed=sea_field("wind_speed"),
        wind_direction=_dominant(
            [
                (o.wind_direction, w)
                for o, w in zip(observations, sea_weights, strict=True)
            ]
        ),
        water_temp=sea_field("water_temp"),
        tone=classify_tone(face),
        weights=observation_weights,
        observed_at=observed_at,
    )
