"""The model's input and output boundary.

Mirrors ``contract.schema.json``, which is the source of truth shared with the
TypeScript side. Everything here is plain JSON-serialisable data: no datetimes,
no numpy types, nothing borrowed from an application. The model is meant to be
reachable over a pipe, so anything that cannot survive that round trip does not
belong in this module.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ConditionTone = Literal["flat", "small", "solid", "large", "xl", "xxl"]


@dataclass(frozen=True)
class BuoyObservation:
    """One buoy's reading, with the position needed to weight it."""

    station_id: str
    lat: float
    lon: float
    observed_at: str  # ISO 8601, UTC
    wave_height: float | None = None  # metres
    dominant_period: float | None = None  # seconds
    avg_period: float | None = None  # seconds
    wave_direction: float | None = None  # degrees true, whence the swell comes
    wind_speed: float | None = None  # m/s
    wind_direction: float | None = None  # degrees true
    water_temp: float | None = None  # degrees C

    @staticmethod
    def from_json(raw: dict[str, Any]) -> BuoyObservation:
        return BuoyObservation(
            station_id=raw["stationId"],
            lat=raw["lat"],
            lon=raw["lon"],
            observed_at=raw["observedAt"],
            wave_height=raw.get("waveHeight"),
            dominant_period=raw.get("dominantPeriod"),
            avg_period=raw.get("avgPeriod"),
            wave_direction=raw.get("waveDirection"),
            wind_speed=raw.get("windSpeed"),
            wind_direction=raw.get("windDirection"),
            water_temp=raw.get("waterTemp"),
        )


@dataclass(frozen=True)
class ForecastRequest:
    target_lat: float
    target_lon: float
    observations: list[BuoyObservation] = field(default_factory=list)
    # Degrees true the break faces. None means no directional weighting.
    facing: float | None = None

    @staticmethod
    def from_json(raw: dict[str, Any]) -> ForecastRequest:
        return ForecastRequest(
            target_lat=raw["target"]["lat"],
            target_lon=raw["target"]["lon"],
            observations=[BuoyObservation.from_json(o) for o in raw["observations"]],
            facing=raw.get("facing"),
        )


@dataclass(frozen=True)
class ObservationWeight:
    """How much one observation contributed, for auditing a forecast."""

    station_id: str
    distance_km: int
    weight: float  # normalised, sums to 1 across the set

    def to_json(self) -> dict[str, Any]:
        return {
            "stationId": self.station_id,
            "distanceKm": self.distance_km,
            "weight": self.weight,
        }


@dataclass(frozen=True)
class Forecast:
    # Blended offshore reading — provenance for the figures below.
    wave_height: float | None  # metres, significant, in deep water
    dominant_period: float | None  # seconds
    swell_power: float | None  # dimensionless index
    # Breaking face height, which is what surf reports describe. face_height is
    # the significant figure and face_height_max the highest tenth, so a client
    # can render the range conventionally ("6 to 8 ft").
    face_height: float | None  # metres
    face_height_max: float | None  # metres
    wind_speed: float | None  # m/s
    wind_direction: float | None  # degrees true
    water_temp: float | None  # degrees C
    tone: ConditionTone
    weights: list[ObservationWeight]
    # Earliest observation in the set — a forecast is only as fresh as this.
    observed_at: str  # ISO 8601, UTC

    def to_json(self) -> dict[str, Any]:
        return {
            "waveHeight": self.wave_height,
            "dominantPeriod": self.dominant_period,
            "swellPower": self.swell_power,
            "faceHeight": self.face_height,
            "faceHeightMax": self.face_height_max,
            "windSpeed": self.wind_speed,
            "windDirection": self.wind_direction,
            "waterTemp": self.water_temp,
            "tone": self.tone,
            "weights": [w.to_json() for w in self.weights],
            "observedAt": self.observed_at,
        }
