"""Regenerate tests/fixtures/blend.json from the current model.

Deliberately not a test. Run it only when the blend has changed on purpose:

    uv run python tests/generate_fixtures.py

Then read the diff. Regenerating without reading it converts a regression test
into a record of whatever the code happened to do, which is worse than having
no fixture at all. Only the fields below are captured — weighting, averaging,
null handling and freshness. Breaking height and the condition label are left
out on purpose: those depend on coefficients and band edges that are expected
to move, and they are covered by the anchors and properties in test_bands.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from swellkit.contract import ReadingRequest  # noqa: E402
from swellkit.triangulate import triangulate  # noqa: E402

BLEND_FIELDS = (
    "waveHeight",
    "dominantPeriod",
    "swellPower",
    "windSpeed",
    "windDirection",
    "waterTemp",
    "weights",
    "observedAt",
)

_seed = 1337


def rnd() -> float:
    global _seed
    _seed = (_seed * 1103515245 + 12345) & 0x7FFFFFFF
    return _seed / 0x7FFFFFFF


def r2(v: float, p: int = 6) -> float:
    return round(v, p)


def observation(**over: object) -> dict:
    base = {
        "stationId": "A",
        "lat": 37.7,
        "lon": -122.5,
        "observedAt": "2026-10-02T12:00:00.000Z",
        "waveHeight": 2.0,
        "dominantPeriod": 12.0,
        "avgPeriod": 8.0,
        "waveDirection": 270.0,
        "windSpeed": 5.0,
        "windDirection": 280.0,
        "waterTemp": 14.0,
    }
    base.update(over)
    return base


def build_cases() -> list[dict]:
    cases: list[dict] = []
    add = lambda name, request: cases.append({"name": name, "request": request})  # noqa: E731

    add("single observation", {
        "target": {"lat": 37.757, "lon": -122.51},
        "observations": [observation()],
    })
    add("every field null", {
        "target": {"lat": 37.757, "lon": -122.51},
        "observations": [observation(**{k: None for k in (
            "waveHeight", "dominantPeriod", "avgPeriod", "waveDirection",
            "windSpeed", "windDirection", "waterTemp")})],
    })
    add("facing into the swell", {
        "target": {"lat": 37.757, "lon": -122.51}, "facing": 270,
        "observations": [observation()],
    })
    add("facing away, weight clamps to zero", {
        "target": {"lat": 37.757, "lon": -122.51}, "facing": 90,
        "observations": [observation()],
    })
    add("zero total weight, the old NaN path", {
        "target": {"lat": 37.757, "lon": -122.51}, "facing": 90,
        "observations": [
            observation(stationId="A", waveDirection=270.0),
            observation(stationId="B", lat=37.9, lon=-122.7, waveDirection=95.0,
                        waveHeight=None, waterTemp=None),
        ],
    })
    add("three observations, directional", {
        "target": {"lat": 37.757, "lon": -122.51}, "facing": 270,
        "observations": [
            observation(stationId="A"),
            observation(stationId="B", lat=37.363, lon=-122.882, waveHeight=3.1,
                        dominantPeriod=16.0, waveDirection=285.0,
                        observedAt="2026-10-02T11:30:00.000Z"),
            observation(stationId="C", lat=35.774, lon=-121.858, waveHeight=1.2,
                        dominantPeriod=6.0, waveDirection=180.0,
                        observedAt="2026-10-02T11:00:00.000Z"),
        ],
    })
    add("partial nulls across the set", {
        "target": {"lat": 40.0, "lon": -73.0},
        "observations": [
            observation(stationId="A", lat=40.25, lon=-73.16, waterTemp=None),
            observation(stationId="B", lat=40.96, lon=-71.12, waveHeight=None,
                        windSpeed=None),
        ],
    })

    maybe = lambda v: None if rnd() < 0.18 else v  # noqa: E731
    for i in range(80):
        target = {"lat": r2(-60 + rnd() * 120), "lon": r2(-179 + rnd() * 358)}
        obs = []
        for j in range(1 + int(rnd() * 3)):
            obs.append({
                "stationId": f"S{j}",
                "lat": r2(target["lat"] + (rnd() - 0.5) * 3),
                "lon": r2(target["lon"] + (rnd() - 0.5) * 3),
                "observedAt": (
                    f"2026-10-{1 + int(rnd() * 27):02d}T"
                    f"{int(rnd() * 24):02d}:{int(rnd() * 60):02d}:00.000Z"
                ),
                "waveHeight": maybe(r2(rnd() * 6)),
                "dominantPeriod": maybe(r2(2 + rnd() * 20)),
                "avgPeriod": maybe(r2(2 + rnd() * 15)),
                "waveDirection": maybe(float(int(rnd() * 360))),
                "windSpeed": maybe(r2(rnd() * 25)),
                "windDirection": maybe(float(int(rnd() * 360))),
                "waterTemp": maybe(r2(rnd() * 30)),
            })
        request: dict = {"target": target, "observations": obs}
        if rnd() < 0.55:
            request["facing"] = float(int(rnd() * 361))
        add(f"random {i}", request)

    return cases


def main() -> None:
    cases = build_cases()
    out = []
    for case in cases:
        reading = triangulate(ReadingRequest.from_json(case["request"])).to_json()
        out.append({
            "name": case["name"],
            "request": case["request"],
            "expected": {k: reading[k] for k in BLEND_FIELDS},
        })

    path = Path(__file__).parent / "fixtures" / "blend.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "generatedBy": "tests/generate_fixtures.py",
        "asserts": list(BLEND_FIELDS),
        "note": "Blend mechanics only. Breaking height and the condition label "
                "are excluded on purpose — see test_bands.py.",
        "cases": out,
    }, indent=2) + "\n")
    print(f"wrote {len(out)} cases to {path}")


if __name__ == "__main__":
    main()
