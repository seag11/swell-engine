"""JSON in, JSON out.

The process boundary exists from the start, even while this lives in the same
repository as its caller, so that moving the model out later changes only where
the image comes from and not how it is invoked.

    echo '{"target":{...},"observations":[...]}' | python -m swellkit
"""

from __future__ import annotations

import json
import sys

from .contract import ForecastRequest
from .triangulate import triangulate

__version__ = "0.1.0"


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv

    if "--version" in args:
        print(__version__)
        return 0

    try:
        raw = json.load(sys.stdin)
    except json.JSONDecodeError as err:
        json.dump({"error": f"invalid JSON on stdin: {err}"}, sys.stdout)
        return 2

    try:
        request = ForecastRequest.from_json(raw)
    except (KeyError, TypeError) as err:
        json.dump({"error": f"request does not match the contract: {err}"}, sys.stdout)
        return 2

    if not request.observations:
        json.dump({"error": "at least one observation is required"}, sys.stdout)
        return 2

    json.dump(triangulate(request).to_json(), sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
