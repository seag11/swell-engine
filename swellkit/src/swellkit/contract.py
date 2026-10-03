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

# NDBC's own sea-state classification, lowercased from the STEEPNESS column.
Steepness = Literal["swell", "average", "steep", "very_steep"]

# Which system a derived figure came from. "total" means the station published
# no partition and the undecomposed sea was used instead.
SystemKind = Literal["swell", "windWave", "total"]


@dataclass(frozen=True)
class WaveSystem:
    """One wave system: a groundswell train or a local wind sea.

    The sea at a buoy is almost never one wave. A 16-second groundswell and a
    5-second chop can arrive together from different directions, and a single
    significant height with a single dominant period describes neither. NDBC
    partitions its spectrum into exactly two such systems; a spectral model
    would give more, which is why this is its own type rather than a pair of
    fields spliced onto the observation.

    Heights combine in quadrature, because energy adds and energy goes as the
    square: swell 1.3m with wind wave 2.0m gives a total of 2.4m, not 3.3m.
    """

    height: float | None = None  # metres, significant, this system alone
    period: float | None = None  # seconds
    direction: float | None = None  # degrees true, whence it comes

    @property
    def is_empty(self) -> bool:
        """True when nothing usable was reported.

        Height and period are both needed to shoal a system, so a partition
        carrying only one of them is no more useful than an absent one.
        """
        return self.height is None or self.period is None

    @staticmethod
    def from_json(raw: dict[str, Any] | None) -> WaveSystem | None:
        if raw is None:
            return None
        return WaveSystem(
            height=raw.get("height"),
            period=raw.get("period"),
            direction=raw.get("direction"),
        )

    def to_json(self) -> dict[str, Any]:
        return {
            "height": self.height,
            "period": self.period,
            "direction": self.direction,
        }


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
    # Spectral partitions. None where the station publishes no .spec file, or
    # publishes one with the partition columns missing — which happens even at
    # stations whose summary wave data is fine.
    swell: WaveSystem | None = None
    wind_wave: WaveSystem | None = None
    steepness: Steepness | None = None

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
            swell=WaveSystem.from_json(raw.get("swell")),
            wind_wave=WaveSystem.from_json(raw.get("windWave")),
            steepness=raw.get("steepness"),
        )


@dataclass(frozen=True)
class ReadingRequest:
    target_lat: float
    target_lon: float
    observations: list[BuoyObservation] = field(default_factory=list)
    # Degrees true the break faces. None means no directional weighting.
    facing: float | None = None

    @staticmethod
    def from_json(raw: dict[str, Any]) -> ReadingRequest:
        return ReadingRequest(
            target_lat=raw["target"]["lat"],
            target_lon=raw["target"]["lon"],
            observations=[BuoyObservation.from_json(o) for o in raw["observations"]],
            facing=raw.get("facing"),
        )


@dataclass(frozen=True)
class ObservationWeight:
    """How much one observation contributed, for auditing a reading."""

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
class Reading:
    # Blended offshore reading of the undecomposed sea — provenance for the
    # figures below, and the only height available from a station with no
    # partition data.
    wave_height: float | None  # metres, significant, in deep water
    dominant_period: float | None  # seconds
    swell_power: float | None  # dimensionless index
    # Breaking face height, which is what surf reports describe. face_height is
    # the significant figure and face_height_max the highest tenth, so a client
    # can render the range conventionally ("6 to 8 ft").
    face_height: float | None  # metres
    face_height_max: float | None  # metres
    # Which system the face came from, since each is shoaled at its own period
    # and the larger wins. Lets a client distinguish real groundswell from a
    # big short-period wind sea that happens to break the same height.
    face_from: SystemKind | None
    # The systems themselves, blended independently: they arrive from different
    # directions, so one can be relevant to a break while the other is not.
    swell: WaveSystem | None
    wind_wave: WaveSystem | None
    steepness: Steepness | None
    wind_speed: float | None  # m/s
    wind_direction: float | None  # degrees true
    water_temp: float | None  # degrees C
    tone: ConditionTone
    weights: list[ObservationWeight]
    # Earliest observation in the set — a reading is only as fresh as this.
    observed_at: str  # ISO 8601, UTC

    def to_json(self) -> dict[str, Any]:
        return {
            "waveHeight": self.wave_height,
            "dominantPeriod": self.dominant_period,
            "swellPower": self.swell_power,
            "faceHeight": self.face_height,
            "faceHeightMax": self.face_height_max,
            "faceFrom": self.face_from,
            "swell": self.swell.to_json() if self.swell else None,
            "windWave": self.wind_wave.to_json() if self.wind_wave else None,
            "steepness": self.steepness,
            "windSpeed": self.wind_speed,
            "windDirection": self.wind_direction,
            "waterTemp": self.water_temp,
            "tone": self.tone,
            "weights": [w.to_json() for w in self.weights],
            "observedAt": self.observed_at,
        }
