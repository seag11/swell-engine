"""Blending buoy observations into a forecast for a point."""

from __future__ import annotations

import math
from collections.abc import Sequence
from datetime import UTC, datetime

from .contract import (
    Forecast,
    ForecastRequest,
    ObservationWeight,
)
from .surf import classify_tone, compute_swell_power

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


def triangulate(request: ForecastRequest) -> Forecast:
    """Inverse-distance weighting, optionally narrowed by which way the break faces.

    Distance weights go as 1/d^2, so a buoy twice as far contributes a quarter as
    much. When ``facing`` is given, each observation is additionally scaled by
    the cosine of the angle between its swell direction and the break, clamped at
    zero: swell arriving from behind the headland is not relevant to this break.

    If every directional weight clamps to zero there is no relevant swell in the
    set, and the blend falls back to distance alone rather than returning nothing.
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

    by_direction = [
        max(0.0, math.cos(_to_rad(o.wave_direction - facing)))
        if facing is not None and o.wave_direction is not None
        else 1.0
        for o in observations
    ]

    # strict=True throughout: these lists are all per-observation, so a length
    # mismatch is a bug rather than something to silently truncate.
    combined = [d * dir_ for d, dir_ in zip(by_distance, by_direction, strict=True)]
    weights = combined if sum(combined) > 0 else by_distance
    total_weight = sum(weights)

    def field(attr: str) -> float | None:
        return _weighted_mean(
            [(getattr(o, attr), w) for o, w in zip(observations, weights, strict=True)]
        )

    wave_height = field("wave_height")
    dominant_period = field("dominant_period")
    swell_power = compute_swell_power(wave_height, dominant_period)

    # Averaging compass bearings is meaningless across the 0/360 wrap, so wind
    # direction is taken from the single most influential observation instead.
    dominant = weights.index(max(weights)) if weights else None

    observation_weights = [
        ObservationWeight(
            station_id=o.station_id,
            distance_km=_js_round(d),
            weight=_js_fixed(w / total_weight, 3),
        )
        for o, d, w in zip(observations, distances, weights, strict=True)
    ]

    observed_at = _format_iso_ms(
        min(_parse_iso_ms(o.observed_at) for o in observations)
    )

    return Forecast(
        wave_height=wave_height,
        dominant_period=dominant_period,
        swell_power=swell_power,
        wind_speed=field("wind_speed"),
        wind_direction=(
            observations[dominant].wind_direction if dominant is not None else None
        ),
        water_temp=field("water_temp"),
        tone=classify_tone(wave_height, swell_power),
        weights=observation_weights,
        observed_at=observed_at,
    )
