"""The contracts, read from the JSON copies this package carries (the same as the npm package's)."""
import json
import os

_HERE = os.path.join(os.path.dirname(__file__), "contracts")


def _read(name):
    with open(os.path.join(_HERE, name), encoding="utf-8") as f:
        return json.load(f)


BID_V1 = _read("bid.v1.json")
PROSPECT_V1 = _read("prospect.v1.json")
MANIFEST_V1 = _read("manifest.v1.json")
