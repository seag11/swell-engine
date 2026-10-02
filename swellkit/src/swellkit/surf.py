"""Wave physics and condition classification."""

from __future__ import annotations

import math

from .contract import ConditionTone

GRAVITY = 9.81
M_TO_FT = 3.28084

# Mean of the highest tenth over the mean of the highest third, for a
# narrow-banded sea. Rayleigh statistics, so the upper end of a reported range
# is the bigger set wave rather than an invented margin.
HIGHEST_TENTH_RATIO = 1.27

# Breaking face height in feet, read as "below this ceiling, this label".
#
# Face height — trough to crest of the breaking wave — is the convention surf
# forecasters agree on.
#
# Anchors, in face height: 6ft is head high, 9ft is well overhead, 12ft is
# double overhead. Those are vernacular facts rather than fitted values.
TONE_BANDS: tuple[tuple[float, ConditionTone], ...] = (
    (2.0, "flat"),
    (4.0, "small"),
    (6.0, "solid"),
    (9.0, "large"),
    (12.0, "xl"),
    (math.inf, "xxl"),
)


def compute_swell_power(
    wave_height: float | None, dominant_period: float | None
) -> float | None:
    """Wave power index: P is proportional to H squared times T.

    Derived from P = (rho * g^2 * H^2 * T) / 32*pi. With rho and g constant the
    relative index reduces to H^2 * T. Energy density scales as H^2; group
    velocity scales with T, so longer-period swell transports energy faster to
    the break.

    Dimensionless, so suited to relative comparison rather than absolute power.
    It is also the quantity Komar & Gaughan take to the two-fifths power, so
    `breaking_height` consumes it directly.
    """
    if wave_height is None or dominant_period is None:
        return None
    return wave_height * wave_height * dominant_period


def breaking_height(
    wave_height: float | None, dominant_period: float | None
) -> float | None:
    """Breaking face height in metres, from deepwater height and period.

    Komar & Gaughan (1972):  Hb = 0.39 * g^(1/5) * (T * H0^2)^(2/5)

    This is the step the model previously skipped. A buoy reports significant
    wave height in deep water, tens or hundreds of kilometres offshore; a surfer
    describes the face of the wave where it breaks. The two differ by a factor
    of roughly 1.25 to 2.0 because long-period swell shoals into a much larger
    face than its offshore height suggests, while short-period wind chop barely
    grows. Classifying the offshore figure reported "4.6 ft" for a wave that
    breaks at over 6.

    0.39 and the exponents are empirical, but they are published fits to field
    data rather than values invented here — the distinction this project draws
    between physics and calibration.

    First-order only: it assumes a plane beach, and ignores refraction and the
    bathymetry that makes a reef and a beach break differ under identical swell.
    It also takes a dominant period already blended across several buoys, which
    smears a clean groundswell together with local chop. Both are limits that
    spectral decomposition and a bathymetry model would lift.
    """
    power = compute_swell_power(wave_height, dominant_period)
    if power is None:
        return None
    return 0.39 * GRAVITY**0.2 * power**0.4


def highest_tenth(breaking_height_m: float | None) -> float | None:
    """The bigger set wave, for the upper end of a reported range.

    Surf is reported as a range because significant height is already a
    distribution: the mean of the highest third. The mean of the highest tenth
    is about 1.27 times that in a narrow-banded sea, which is where a reported
    "6 to 8 ft" comes from.
    """
    if breaking_height_m is None:
        return None
    return breaking_height_m * HIGHEST_TENTH_RATIO


def classify_tone(breaking_height_m: float | None) -> ConditionTone:
    """Label conditions by breaking face height against TONE_BANDS.

    Takes breaking height, not the offshore reading. There is no longer a
    power-based upgrade: raising a label one level on crossing a fixed power
    threshold was a step function standing in for a smooth curve, so a single
    second of period could flip a category while the wave changed by inches.
    Period now enters through `breaking_height`, where it belongs.

    A None height is 'flat' rather than an error: a buoy set with no usable wave
    data should read as nothing happening, not as the largest possible surf.
    """
    if breaking_height_m is None:
        return "flat"

    ft = breaking_height_m * M_TO_FT
    for ceiling, label in TONE_BANDS:
        if ft < ceiling:
            return label
    return TONE_BANDS[-1][1]
