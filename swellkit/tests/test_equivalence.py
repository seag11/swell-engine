"""The Python port must reproduce the TypeScript model exactly.

Fixtures in ``fixtures/golden.json`` are reference outputs captured from
``@swell-engine/model``. Regenerate them only when the TypeScript model changes
deliberately, never to make a failing test pass — that would erase the baseline
these tests exist to protect.

Once the ports agree, improvements are attributable: any later change in output
comes from new physics rather than a translation error.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from swellkit.contract import ForecastRequest
from swellkit.triangulate import triangulate

FIXTURES = json.loads((Path(__file__).parent / "fixtures" / "golden.json").read_text())
CASES = FIXTURES["cases"]

SCALAR_FIELDS = [
    "waveHeight",
    "dominantPeriod",
    "swellPower",
    "windSpeed",
    "windDirection",
    "waterTemp",
]


def _ids() -> list[str]:
    return [c["name"] for c in CASES]


@pytest.mark.parametrize("case", CASES, ids=_ids())
def test_matches_typescript(case: dict) -> None:
    actual = triangulate(ForecastRequest.from_json(case["request"])).to_json()
    expected = case["expected"]

    for key in SCALAR_FIELDS:
        got, want = actual[key], expected[key]
        if want is None or got is None:
            assert got == want, f"{key}: {got!r} != {want!r}"
        else:
            # 126 of these 128 cases are bit-identical. The tolerance exists for
            # `cos`, which is not bit-reproducible across runtimes: V8 ships its
            # own fdlibm port while CPython calls the platform libm, and they
            # agree to about one unit in the last place. Arithmetic ordering,
            # degree conversion and rounding are all matched exactly, so this is
            # deliberately tight enough that any real drift still fails.
            assert got == pytest.approx(want, rel=1e-15), f"{key}: {got!r} != {want!r}"

    assert actual["tone"] == expected["tone"]
    assert actual["observedAt"] == expected["observedAt"]
    assert actual["weights"] == expected["weights"]


def test_fixture_coverage() -> None:
    """Guard against the corpus silently losing the cases that matter."""
    tones = {c["expected"]["tone"] for c in CASES}
    assert tones == {"flat", "small", "solid", "large", "xxl"}

    assert any(c["expected"]["waveHeight"] is None for c in CASES), "no null-wave cases"
    assert any("facing" in c["request"] for c in CASES), "no directional cases"
    assert any(len(c["request"]["observations"]) == 3 for c in CASES), "no 3-buoy cases"
