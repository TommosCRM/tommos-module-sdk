"""The reader of the small part of JSON Schema the contracts use; the same reader as src/schema.js, the same words."""
import json
import re
from datetime import date
from urllib.parse import urlparse

_A_DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_AN_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _is_a_date(s):
    m = _A_DATE.match(s)
    if not m:
        return False
    try:
        date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        return True
    except ValueError:
        return False


def _is_a_link(s):
    try:
        u = urlparse(s)
    except ValueError:
        return False
    return u.scheme in ("http", "https") and bool(u.hostname) and not re.search(r"\s", s)


def _type_of(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "integer" if v.is_integer() else "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return type(v).__name__


def _has_type(v, t):
    got = _type_of(v)
    if t == "number":
        return got in ("number", "integer")
    return got == t


def _where(path):
    return path or "the record"


def _dumps(v):
    return json.dumps(v, separators=(",", ":"), ensure_ascii=False)


def reasons_it_fails(schema, value, path=""):
    """Each reason `value` fails `schema`, as words; an empty list when it holds."""
    out = []
    if "const" in schema and _dumps(value) != _dumps(schema["const"]):
        out.append(f"{_where(path)} must be {_dumps(schema['const'])}")
    if "enum" in schema and not any(_dumps(e) == _dumps(value) for e in schema["enum"]):
        out.append(f"{_where(path)} must be one of {', '.join(_dumps(e) for e in schema['enum'])}")
    t = schema.get("type")
    if t and not _has_type(value, t):
        word = {"integer": "a whole number", "array": "a list", "object": "an object"}.get(t, f"a {t}")
        out.append(f"{_where(path)} must be {word}")
        return out
    if isinstance(value, str):
        if "minLength" in schema and len(value.strip()) < schema["minLength"]:
            out.append(f"{_where(path)} is empty")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            out.append(f"{_where(path)} is longer than {schema['maxLength']} characters")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            out.append(f"{_where(path)} has a wrong form («{value[:80]}»)")
        fmt = schema.get("format")
        if fmt == "date" and not _is_a_date(value):
            out.append(f"{_where(path)} is not a date (YYYY-MM-DD)")
        if fmt == "email" and not _AN_EMAIL.match(value):
            out.append(f"{_where(path)} is not an email address")
        if fmt == "uri" and not _is_a_link(value):
            out.append(f"{_where(path)} is not a link (http or https)")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            out.append(f"{_where(path)} is less than {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            out.append(f"{_where(path)} is more than {schema['maximum']}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            out.append(f"{_where(path)} must hold at least {schema['minItems']}")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            out.append(f"{_where(path)} holds more than {schema['maxItems']}")
        if "items" in schema:
            for i, v in enumerate(value):
                out.extend(reasons_it_fails(schema["items"], v, f"{path}[{i}]"))
    if isinstance(value, dict):
        for k in schema.get("required", []):
            if value.get(k) is None:
                out.append(f"{path + '.' if path else ''}{k} is missing")
        props = schema.get("properties", {})
        for k, v in value.items():
            p = f"{path}.{k}" if path else k
            if k in props:
                if v is not None:
                    out.extend(reasons_it_fails(props[k], v, p))
            elif schema.get("additionalProperties") is False:
                out.append(f"{p} is not a field of this contract")
    return out
