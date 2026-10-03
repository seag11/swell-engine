"""Regression cover for the blend: weighting, averaging, nulls, freshness.

These fixtures assert the machinery that is not expected to change — inverse
distance weighting, directional clamping, weighted means over partial data, and
which observation's timestamp wins. Breaking height and the condition label are
deliberately absent: they depend on coefficients and band edges that will move,
and test_bands.py covers them with anchors and properties instead.

Regenerate with tests/generate_fixtures.py only when the blend changes on
purpose, and read the diff when you do.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from swellkit.contract import ReadingRequest
from swellkit.triangulate import triangulate

FIXTURES = json.loads((Path(__file__).parent / "fixtures" / "blend.json").read_text())
CASES = FIXTURES["cases"]
ASSERTED = FIXTURES["asserts"]

# Wave systems are nested objects, so they are compared field by field rather
# than whole: height and period are blended floats needing a tolerance, while
# direction is carried through from one station and compares exactly.
SYSTEMS = [f for f in ASSERTED if f in ("swell", "windWave")]
SCALARS = [f for f in ASSERTED if f not in ("weights", "observedAt", *SYSTEMS)]


def _same(got: object, want: object, label: str) -> None:
    if want is None or got is None or not isinstance(want, int | float):
        assert got == want, f"{label}: {got!r} != {want!r}"
    else:
        assert got == pytest.approx(want, rel=1e-12), f"{label}: {got!r} != {want!r}"


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_blend_matches_baseline(case: dict) -> None:
    actual = triangulate(ReadingRequest.from_json(case["request"])).to_json()
    expected = case["expected"]

    for key in SCALARS:
        _same(actual[key], expected[key], key)

    for key in SYSTEMS:
        got, want = actual[key], expected[key]
        if want is None or got is None:
            assert got == want, f"{key}: {got!r} != {want!r}"
            continue
        for part in ("height", "period", "direction"):
            _same(got[part], want[part], f"{key}.{part}")

    assert actual["weights"] == expected["weights"]
    assert actual["observedAt"] == expected["observedAt"]


def test_fixtures_exclude_the_volatile_fields() -> None:
    """Guard the split, so a future regeneration cannot quietly re-weld them."""
    assert "tone" not in ASSERTED
    assert "faceHeight" not in ASSERTED
    assert "faceHeightMax" not in ASSERTED
    # faceFrom names the system the face came from, so it moves whenever the
    # breaking-height coefficients move. The partitions themselves are blend
    # mechanics and do belong here.
    assert "faceFrom" not in ASSERTED


def test_fixture_coverage() -> None:
    requests = [c["request"] for c in CASES]
    assert any("facing" in r for r in requests), "no directional cases"
    assert any(len(r["observations"]) == 3 for r in requests), "no 3-buoy cases"
    assert any(
        any(o["waveHeight"] is None for o in r["observations"]) for r in requests
    ), "no null-wave cases"
    assert any(
        any(o.get("swell") and o.get("windWave") for o in r["observations"])
        for r in requests
    ), "no two-system cases"
    assert any(
        len(r["observations"]) > 1
        and any(o.get("swell") for o in r["observations"])
        and any(not o.get("swell") for o in r["observations"])
        for r in requests
    ), "no mixed partition-coverage cases"


def test_weights_sum_to_one() -> None:
    for case in CASES:
        reading = triangulate(ReadingRequest.from_json(case["request"])).to_json()
        total = sum(w["weight"] for w in reading["weights"])
        assert total == pytest.approx(1.0, abs=0.002), case["name"]


def test_blend_stays_within_the_range_of_its_inputs() -> None:
    """A weighted mean cannot exceed the values it averages."""
    for case in CASES:
        request = ReadingRequest.from_json(case["request"])
        reading = triangulate(request)
        for attr, out in (
            ("wave_height", reading.wave_height),
            ("dominant_period", reading.dominant_period),
            ("water_temp", reading.water_temp),
        ):
            present = [getattr(o, attr) for o in request.observations]
            present = [v for v in present if v is not None]
            if out is None or not present:
                continue
            assert min(present) - 1e-9 <= out <= max(present) + 1e-9, (
                f"{case['name']}: {attr} {out} outside {min(present)}..{max(present)}"
            )
