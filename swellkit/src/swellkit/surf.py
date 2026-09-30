"""Wave physics and condition classification."""

from __future__ import annotations

from typing import Optional

from .contract import ConditionTone

HIGH_POWER_THRESHOLD = 16.0

# Classification thresholds below are in feet, so this value affects results.
M_TO_FT = 3.28084


def compute_swell_power(
    wave_height: Optional[float], dominant_period: Optional[float]
) -> Optional[float]:
    """Wave power index: P is proportional to H squared times T.

    Derived from P = (rho * g^2 * H^2 * T) / 32*pi. With rho and g constant the
    relative index reduces to H^2 * T. Energy density scales as H^2; group
    velocity scales with T, so longer-period swell transports energy faster to
    the break.

    Dimensionless, so suited to relative comparison rather than absolute power.
    2m at 18s (about 72) carries roughly 8x the power of 3m at 4s (about 36).
    """
    if wave_height is None or dominant_period is None:
        return None
    return wave_height * wave_height * dominant_period


def classify_tone(
    wave_height_m: Optional[float], swell_power: Optional[float] = None
) -> ConditionTone:
    """Label conditions by height in feet, upgraded one level for high power.

    The upgrade reflects that long-period ground swell breaks with considerably
    more force than wind chop of the same height.

    Thresholds: <1ft flat, 1-3ft small, 3-6ft solid, 6-10ft large, 10ft+ xxl.
    Power upgrade (P > 16): small->solid, solid->large, large->xxl.

    A None height is 'flat' rather than an error: a buoy set with no usable wave
    data should read as nothing happening, not as the largest possible surf.
    """
    if wave_height_m is None:
        return "flat"

    ft = wave_height_m * M_TO_FT
    if ft < 1:
        return "flat"

    high_power = swell_power is not None and swell_power > HIGH_POWER_THRESHOLD

    if ft < 3:
        return "solid" if high_power else "small"
    if ft < 6:
        return "large" if high_power else "solid"
    if ft < 10:
        return "xxl" if high_power else "large"
    return "xxl"
