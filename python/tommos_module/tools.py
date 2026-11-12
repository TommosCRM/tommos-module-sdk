"""The tools of Tommos for a module (MOD-01.2 item 2): the same tools as the npm package, in Python."""
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

from .contracts import BID_V1, PROSPECT_V1
from .schema import reasons_it_fails

VERSION = "0.1.0"

# ---------------------------------------------------------------- the log of the run (MOD-02.2 items 4, 7)
THE_MOST_LINES_OF_A_RUN = 500
A_LINE_IS_AT_MOST = 500
_LINES = []
_DROPPED = [0]
_QUERY = re.compile(r"(https?://[^\s?#\"'<>]+)\?[^\s#\"'<>]*", re.I)


def without_secrets(text):
    """The values of the module's secrets (Tommos names them in TOMMOS_SECRET_NAMES), and the query of each address,
    taken out of a text before it is kept."""
    t = str(text if text is not None else "")
    for name in [n for n in os.environ.get("TOMMOS_SECRET_NAMES", "").split(",") if n]:
        v = os.environ.get(name)
        if v and len(v) >= 4:
            t = t.replace(v, "[secret]")
    return _QUERY.sub(r"\1?[query]", t)


def _words(v, most=A_LINE_IS_AT_MOST):
    return without_secrets(v if isinstance(v, str) else json.dumps(v, ensure_ascii=False))[:most]


def _keep(line):
    if len(_LINES) >= THE_MOST_LINES_OF_A_RUN:
        _DROPPED[0] += 1
        return
    _LINES.append(line)


class _Log:
    """The module's own lines of the log, of three kinds only:
    log.read(where, count): what it read and how much;
    log.skipped(key, reason): a record it dropped, and why;
    log.warning(text): something a person should know."""

    def read(self, where, count):
        try:
            n = float(count)
            n = int(n) if n.is_integer() else n
        except (TypeError, ValueError):
            n = None
        _keep({"kind": "read", "where": _words(where, 300), "count": n})

    def skipped(self, key, reason):
        _keep({"kind": "skipped", "key": _words(key, 300), "reason": _words(reason)})

    def warning(self, text):
        _keep({"kind": "warning", "text": _words(text)})


log = _Log()


def lines_of_the_log():
    return {"lines": list(_LINES), "dropped": _DROPPED[0]}


# ---------------------------------------------------------------- the domain, the date and the key
_A_HOST = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$")


def a_domain(v):
    """A company's domain: lower case, no www, no port, no path; None when it is not a domain."""
    if not isinstance(v, str) or not v.strip():
        return None
    s = v.strip().lower()
    if not re.match(r"^[a-z][a-z0-9+.-]*://", s):
        s = "https://" + s
    try:
        host = urlparse(s).hostname or ""
    except ValueError:
        return None
    host = re.sub(r"^www\d?\.", "", host.rstrip("."))
    return host if _A_HOST.match(host) else None


def a_date(v):
    """A day as YYYY-MM-DD (UTC), from an ISO date or time, an email date, a date or a datetime; None when it is none."""
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = str(v).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        try:
            return date.fromisoformat(s).isoformat()
        except ValueError:
            return None
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).date().isoformat()
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc).date().isoformat()
    except (TypeError, ValueError):
        return None


def a_key(*parts):
    """A record's key from its parts: joined by «:»; a key longer than 200 characters is its SHA-256."""
    k = ":".join(str(p).strip() for p in parts if p is not None and str(p).strip())
    if not k:
        raise ContractError(["the key is empty"], None)
    return k if len(k) <= 200 else hashlib.sha256(k.encode()).hexdigest()


# ---------------------------------------------------------------- the builders
class ContractError(Exception):
    """A record that fails its contract. `reasons` says why in words; `record` is what the builder made, so a module
    can still give it back and Tommos refuses it with its reasons in the run's log."""

    def __init__(self, reasons, record):
        super().__init__("The record fails its contract: " + "; ".join(reasons))
        self.reasons = reasons
        self.record = record


def _clean(o):
    if isinstance(o, list):
        return [_clean(x) for x in o]
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if v is None or v == "":
                continue
            c = _clean(v)
            if isinstance(c, dict) and not c:
                continue
            out[k] = c
        return out
    return o.strip() if isinstance(o, str) else o


def a_bid(**fields):
    """A bid as the contract Bid v1 holds it: empty fields dropped, dates made days; raises ContractError when it fails."""
    for k in ("due_date", "posted_date"):
        if fields.get(k) is not None:
            fields[k] = a_date(fields[k]) or fields[k]
    r = _clean(fields)
    reasons = reasons_it_fails(BID_V1, r)
    if reasons:
        raise ContractError(reasons, r)
    return r


def a_prospect(**fields):
    """A prospect as the contract Prospect v1 holds it: the domain made plain, each evidence's date a day; raises
    ContractError when it fails."""
    if isinstance(fields.get("evidence"), list):
        fields["evidence"] = [dict(e, date=(a_date(e.get("date")) or e.get("date"))) if isinstance(e, dict) else e for e in fields["evidence"]]
    fields["domain"] = a_domain(fields.get("domain")) or fields.get("domain")
    r = _clean(fields)
    reasons = reasons_it_fails(PROSPECT_V1, r)
    if reasons:
        raise ContractError(reasons, r)
    return r


# ---------------------------------------------------------------- the cursor
def the_cursor(context, start=None):
    """The cursor Tommos gave this run, or `start` on the first run. Tommos keeps the cursor a run gives back only when
    the run worked."""
    c = (context or {}).get("cursor")
    return start if c is None else c


# ---------------------------------------------------------------- the model, through Tommos (MOD-01.3)
class AskRefused(Exception):
    """A call of «ask» Tommos refused: over the run's calls, over the day's spend, or no model runs for the workspace."""


_ASKED = [0]


def ask(cls, prompt, system=None, max_tokens=1000, json_answer=False):
    """Ask a model through Tommos. `cls` is the class of the task, "fast" or "smart"; Tommos picks the model of that
    class from its tested list and calls it on its own key, with the pass of this run. No key and no model name stand
    in a module. While Tommos runs the examples, the answers come from responses.json, "ask", one after another."""
    if cls not in ("fast", "smart"):
        raise AskRefused("ask needs the class of the task: «fast» or «smart»")
    if not isinstance(prompt, str) or not prompt.strip():
        raise AskRefused("ask needs a prompt")
    answers = _answers_of_the_example()
    if answers:
        listed = answers["map"].get("ask") or []
        if _ASKED[0] >= len(listed):
            raise AskRefused('This example holds no answer of «ask» for this call: add one to responses.json, "ask": [{ "text": "..." }]')
        a = listed[_ASKED[0]]
        _ASKED[0] += 1
        out = {"text": str(a.get("text", ""))}
        if json_answer:
            out["json"] = a.get("json", json.loads(a.get("text") or "null"))
        return out
    url = os.environ.get("TOMMOS_ASK_URL")
    if not url:
        raise AskRefused("This run has no door to ask a model: the manifest names max_model_calls_per_run 0")
    body = json.dumps({"class": cls, "system": system, "prompt": prompt, "maxTokens": max_tokens, "json": bool(json_answer)}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            got = json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        got = json.loads(e.read().decode() or "{}") if e.fp else {}
        raise AskRefused(str(got.get("reason") or f"Tommos answered {e.code}"))
    if not got.get("ok"):
        raise AskRefused(str(got.get("reason") or "Tommos refused the call"))
    out = {"text": str(got.get("text", ""))}
    if json_answer:
        out["json"] = got.get("json")
    return out


# ---------------------------------------------------------------- the fetch
class FetchError(Exception):
    """A refusal of the fetch: the host is not in the manifest, or the source did not answer after the tries."""

    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def _allowed():
    return [h.strip().lower() for h in os.environ.get("TOMMOS_HOSTS", "").split(",") if h.strip()]


def _host_is_allowed(host, allowed):
    return any(host == a[2:] or host.endswith(a[1:]) if a.startswith("*.") else host == a for a in allowed)


class Answer:
    def __init__(self, url, status, body, headers=None):
        self.url = url
        self.status = status
        self.ok = 200 <= status < 300
        self.headers = headers or {}
        self._body = body

    def text(self):
        return self._body

    def json(self):
        return json.loads(self._body)


_last_call_at = {}
_hosts_asked = set()


def hosts_this_run_asked():
    """Each host the module asked for in this run, reached or refused (the check's item h reads it)."""
    return sorted(_hosts_asked)
_answers = None


def _answers_of_the_example():
    global _answers
    if _answers is None:
        f = os.environ.get("TOMMOS_RESPONSES", "")
        if f:
            with open(f, encoding="utf-8") as fh:
                _answers = {"dir": os.path.dirname(f), "map": json.load(fh)}
        else:
            _answers = False
    return _answers or None


def fetch(url, tries=3, wait_ms=500, timeout_s=30, headers=None, method="GET", body=None):
    """Fetch a URL. Only a host of the manifest is reached; any other is refused before a call. A call waits `wait_ms`
    after the last call to the same host. A 429, a 5xx or no answer is tried again, `tries` times in all, with a longer
    wait each time. While Tommos runs the examples, the answers come from `responses.json`, and a URL it does not hold
    is refused."""
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        host = ""
    if not host:
        raise FetchError(f"«{url}» is not a link")
    allowed = _allowed()
    _hosts_asked.add(host)
    if not _host_is_allowed(host, allowed):
        raise FetchError(f"The manifest does not name the host {host}: it names {', '.join(allowed) or 'no host'}")
    answers = _answers_of_the_example()
    if answers:
        a = answers["map"].get(url)
        if not a:
            raise FetchError(f"This example holds no answer for {url}")
        if a.get("file"):
            with open(os.path.join(answers["dir"], a["file"]), encoding="utf-8") as fh:
                text = fh.read()
        else:
            b = a.get("body", "")
            text = b if isinstance(b, str) else json.dumps(b)
        return Answer(url, a.get("status", 200), text, a.get("headers"))
    why = ""
    for t in range(1, tries + 1):
        wait = _last_call_at.get(host, 0) + wait_ms / 1000 - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_call_at[host] = time.time()
        req = urllib.request.Request(url, data=body, method=method, headers={"User-Agent": "Tommos module (+https://tommos.ai)", **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as r:
                final = (urlparse(r.geturl()).hostname or "").lower()
                if not _host_is_allowed(final, allowed):
                    raise FetchError(f"{host} sent the call on to {final}, a host the manifest does not name")
                return Answer(url, r.status, r.read().decode("utf-8", "replace"), dict(r.headers))
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                why = f"{host} answered {e.code}"
            else:
                return Answer(url, e.code, e.read().decode("utf-8", "replace"), dict(e.headers or {}))
        except FetchError:
            raise
        except Exception as e:  # no answer: tried again
            why = f"{host} did not answer ({e})"
        if t < tries:
            time.sleep(t)
    raise FetchError(f"{why}, {tries} times")
