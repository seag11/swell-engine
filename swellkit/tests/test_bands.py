"""Vernacular anchors and properties for condition labelling.

These replace most of what a random fixture corpus was doing for
classification. "Six feet of face is head high" is a fact about surfing that
survives any coefficient change; "random case 72 yields xxl" is a fact about one
afternoon's thresholds. When the bands move, the anchors below are what should
be re-argued — not silently regenerated.
"""

from __future__ import annotations

import math

import pytest

from swellkit.contract import Reading, ReadingRequest
from swellkit.surf import (
    M_TO_FT,
    TONE_BANDS,
    breaking_height,
    classify_tone,
    highest_tenth,
)
from swellkit.triangulate import triangulate

FT_TO_M = 1 / M_TO_FT


def tone_for_face_ft(ft: float) -> str:
    return classify_tone(ft * FT_TO_M)


# ---------------------------------------------------------------- the table


def test_bands_are_ordered_and_gapless() -> None:
    ceilings = [c for c, _ in TONE_BANDS]
    assert ceilings == sorted(ceilings), "bands must ascend"
    assert len(set(ceilings)) == len(ceilings), "no duplicate ceilings"
    assert ceilings[-1] == math.inf, "the last band must be open-ended"


def test_bands_cover_every_height() -> None:
    for ft in [0, 0.5, 1.9, 2, 3.9, 4, 5.9, 6, 8.9, 9, 11.9, 12, 20, 60]:
        assert tone_for_face_ft(ft) in {label for _, label in TONE_BANDS}


def test_labels_are_unique() -> None:
    labels = [label for _, label in TONE_BANDS]
    assert len(set(labels)) == len(labels)


# --------------------------------------------------- vernacular anchor points
# Face height, the convention surf forecasters agree on. A surfer of average
# height makes these concrete, which is why they are stable.


@pytest.mark.parametrize(
    ("face_ft", "expected", "why"),
    [
        (0.5, "flat", "ankle slop"),
        (1.5, "flat", "shin high, not worth the paddle"),
        (2.5, "small", "knee to thigh"),
        (3.5, "small", "waist high"),
        (4.5, "solid", "chest high"),
        (5.5, "solid", "shoulder high"),
        (6.5, "large", "just overhead"),
        (8.0, "large", "a foot or two overhead"),
        (9.5, "xl", "well overhead, around 1.5x"),
        (11.0, "xl", "approaching double overhead"),
        (12.5, "xxl", "double overhead"),
        (20.0, "xxl", "big-wave territory"),
    ],
)
def test_vernacular_anchors(face_ft: float, expected: str, why: str) -> None:
    assert tone_for_face_ft(face_ft) == expected, f"{face_ft}ft is {why}"


def test_head_high_is_the_solid_large_boundary() -> None:
    """Six feet of face is head high, and that is where 'large' starts."""
    assert tone_for_face_ft(5.9) == "solid"
    assert tone_for_face_ft(6.0) == "large"


def test_double_overhead_is_where_xxl_starts() -> None:
    assert tone_for_face_ft(11.9) == "xl"
    assert tone_for_face_ft(12.0) == "xxl"


def test_a_chest_high_wave_is_never_the_top_label() -> None:
    """The regression that prompted this work: 4.6ft offshore read as xxl."""
    assert tone_for_face_ft(4.6) not in {"xl", "xxl"}


# ------------------------------------------------------------- properties


def test_tone_is_monotonic_in_height() -> None:
    """A bigger wave never earns a smaller label."""
    order = [label for _, label in TONE_BANDS]
    rank = {label: i for i, label in enumerate(order)}
    previous = -1
    ft = 0.0
    while ft <= 40:
        r = rank[tone_for_face_ft(ft)]
        assert r >= previous, f"label went backwards at {ft}ft"
        previous = r
        ft += 0.1


def test_breaking_height_rises_with_offshore_height() -> None:
    for t in (6, 10, 16, 20):
        previous = -1.0
        for h in [x / 10 for x in range(1, 61)]:
            hb = breaking_height(h, t)
            assert hb > previous, f"not monotonic at H0={h} T={t}"
            previous = hb


def test_breaking_height_rises_with_period() -> None:
    for h in (0.5, 1.0, 2.0, 4.0):
        previous = -1.0
        for t in range(3, 26):
            hb = breaking_height(h, t)
            assert hb > previous, f"not monotonic at H0={h} T={t}"
            previous = hb


GRAVITY = 9.81
# Deepwater steepness H0/L0, where L0 = gT^2/2pi. Ordinary swell sits near
# 0.01; a sea steeper than roughly 0.14 is already breaking offshore. The
# formula is only meaningful below a modest fraction of that.
MAX_SWELL_STEEPNESS = 0.04


def steepness(h0: float, t: float) -> float:
    return h0 / (GRAVITY * t * t / (2 * math.pi))


# Below this the surf is flat whatever the period, so the ratio stops
# mattering — and a 0.2m reading at 24s is where the formula's extrapolation
# pushes amplification past 3x.
MIN_INTERESTING_HEIGHT_M = 0.3


def realistic_swell() -> list[tuple[float, float]]:
    """Height and period pairs a buoy could plausibly report as rideable swell."""
    return [
        (h / 10, t)
        for h in range(int(MIN_INTERESTING_HEIGHT_M * 10), 81)
        for t in range(4, 26)
        if steepness(h / 10, t) <= MAX_SWELL_STEEPNESS
    ]


def test_shoaling_amplifies_across_realistic_swell() -> None:
    """Swell never breaks smaller than its deepwater height."""
    for h, t in realistic_swell():
        assert breaking_height(h, t) > h, f"Hb < H0 at H0={h} T={t}"


def test_amplification_is_bounded_across_realistic_swell() -> None:
    for h, t in realistic_swell():
        ratio = breaking_height(h, t) / h
        assert 1.0 < ratio < 3.0, f"Hb/H0 = {ratio:.2f} at H0={h} T={t}"


def test_steep_seas_fall_outside_the_formula() -> None:
    """A steep short-period sea breaks below its offshore height on this model.

    4m at 6s has a steepness near 0.07 — a storm sea already whitecapping in
    deep water, not swell — and K&G returns 3.8m, less than the offshore
    reading. Recorded so the limit is documented rather than rediscovered as a
    bug: during a local storm this model understates. Separating the storm sea
    from any underlying swell is what spectral decomposition would fix.
    """
    assert steepness(4.0, 6) > MAX_SWELL_STEEPNESS
    assert breaking_height(4.0, 6) < 4.0


def test_long_period_forerunner_also_falls_outside() -> None:
    """A tiny 24s forerunner amplifies past 3x here.

    The direction is right — a 24s wave has a wavelength near 900m and feels
    the bottom far offshore — but it is extrapolation, not prediction.
    """
    assert breaking_height(0.2, 24) / 0.2 > 3.0


def test_long_period_breaks_bigger_than_short_at_equal_height() -> None:
    """The reason the old power-upgrade rule existed at all."""
    assert breaking_height(1.4, 18) > breaking_height(1.4, 8)


def test_nulls_propagate() -> None:
    assert breaking_height(None, 10) is None
    assert breaking_height(1.4, None) is None
    assert highest_tenth(None) is None
    assert classify_tone(None) == "flat"


def test_highest_tenth_exceeds_the_significant_figure() -> None:
    for hb in (0.3, 1.0, 2.5, 6.0):
        assert highest_tenth(hb) > hb
        assert highest_tenth(hb) < hb * 2


def test_komar_gaughan_against_a_worked_value() -> None:
    """1.4m at 9s offshore breaks near 1.94m, or about 6.4ft of face."""
    hb = breaking_height(1.4, 9)
    assert hb == pytest.approx(1.94, abs=0.01)
    assert hb * M_TO_FT == pytest.approx(6.37, abs=0.02)
    assert classify_tone(hb) == "large"


# ------------------------------------------------- partitioned seas
# Properties of shoaling each wave system at its own period rather than
# shoaling the sea as a whole. These hold regardless of where the bands sit,
# which is why they live here and not in the blend fixtures.


def _face(height: float, period: float, direction: float = 270.0) -> float:
    request = ReadingRequest.from_json({
        "target": {"lat": 37.757, "lon": -122.51},
        "observations": [{
            "stationId": "A", "lat": 37.759, "lon": -122.833,
            "observedAt": "2026-10-02T12:00:00.000Z",
            "waveHeight": height, "dominantPeriod": period,
            "waveDirection": direction,
        }],
    })
    return triangulate(request).face_height


def _partitioned(
    total: float,
    swell: tuple[float, float],
    wind_wave: tuple[float, float],
) -> Reading:
    sh, sp = swell
    wh, wp = wind_wave
    return triangulate(ReadingRequest.from_json({
        "target": {"lat": 37.757, "lon": -122.51},
        "observations": [{
            "stationId": "A", "lat": 37.759, "lon": -122.833,
            "observedAt": "2026-10-02T12:00:00.000Z",
            "waveHeight": total, "dominantPeriod": wp, "waveDirection": 270.0,
            "swell": {"height": sh, "period": sp, "direction": 270.0},
            "windWave": {"height": wh, "period": wp, "direction": 270.0},
        }],
    }))


def test_the_face_comes_from_a_system_not_the_whole_sea() -> None:
    """The smear this replaces.

    A 0.3m 14s forerunner under a 1.6m 5s sea has a blended dominant period
    belonging to neither. Shoaling the pair as one sea invents a wave; shoaling
    each at its own period does not, and the label says which one won.
    """
    reading = _partitioned(1.63, swell=(0.3, 14.0), wind_wave=(1.6, 5.0))
    assert reading.face_from == "windWave", "the wind sea holds the energy here"
    assert reading.swell is not None and reading.wind_wave is not None
    # The long-period forerunner survives as its own system rather than being
    # averaged into the chop and disappearing.
    assert reading.swell.period == 14.0
    assert reading.wind_wave.period == 5.0


def test_a_small_long_period_swell_does_not_inflate_a_short_period_sea() -> None:
    """Partitioning must not report more surf than the sea can hold.

    The face from the partitioned view stays near the face the undecomposed sea
    would give, because the rescale keeps total energy fixed. What changes is
    the attribution, not the size.
    """
    reading = _partitioned(1.63, swell=(0.3, 14.0), wind_wave=(1.6, 5.0))
    smeared = _face(1.63, 5.0)
    assert reading.face_height == pytest.approx(smeared, rel=0.05)


def test_the_larger_face_wins_regardless_of_which_system_it_is() -> None:
    """A groundswell does not win by being a groundswell.

    Two metres at eight seconds is rideable and outranks a metre at ten. The
    comparison is on breaking height alone, which is what makes it fair: Komar
    & Gaughan already penalises a steep sea.
    """
    swell_wins = _partitioned(2.3, swell=(2.2, 14.0), wind_wave=(0.7, 5.0))
    chop_wins = _partitioned(2.3, swell=(0.7, 10.0), wind_wave=(2.2, 8.0))
    assert swell_wins.face_from == "swell"
    assert chop_wins.face_from == "windWave"


def test_partitions_preserve_the_energy_of_the_blended_sea() -> None:
    """Heights combine in quadrature, so the rescale must hold that identity.

    This is what stops a distant station's partition from over-reporting a sea
    that the nearer stations measured smaller.
    """
    for total, swell, chop in [
        (2.4, (1.3, 10.0), (2.0, 7.7)),
        (1.2, (0.9, 10.0), (0.8, 4.2)),
        (1.63, (0.3, 14.0), (1.6, 5.0)),
    ]:
        reading = _partitioned(total, swell=swell, wind_wave=chop)
        assert reading.swell is not None and reading.wind_wave is not None
        combined = math.hypot(reading.swell.height, reading.wind_wave.height)
        assert combined == pytest.approx(reading.wave_height, rel=1e-12)


def test_an_unpartitioned_sea_still_gets_a_face() -> None:
    """Several stations publish no partition at all. They must not go dark."""
    reading = triangulate(ReadingRequest.from_json({
        "target": {"lat": 40.0, "lon": -73.0},
        "observations": [{
            "stationId": "44025", "lat": 40.251, "lon": -73.164,
            "observedAt": "2026-10-02T12:00:00.000Z",
            "waveHeight": 1.2, "dominantPeriod": 6.0, "waveDirection": 197.0,
        }],
    }))
    assert reading.face_from == "total"
    assert reading.face_height is not None
    assert reading.swell is None and reading.wind_wave is None
