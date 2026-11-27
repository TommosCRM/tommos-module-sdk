// The tools of Tommos for a module (MOD-01.2 item 2): a fetch that retries, waits between calls and reaches only the
// hosts of the manifest; the cursor; the builders of a bid and a prospect that check the contract; the domain, the
// date and the key; the log of the run. The Python package (`python/tommos_module`) holds the same tools.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BID_V1, PROSPECT_V1 } from "./contracts.js";
import { theReasonsItFails } from "./schema.js";

export const VERSION = "0.3.0";

// ---------------------------------------------------------------- the log of the run (MOD-02.2 items 4, 7)

/** A run keeps at most this many lines of the module, each at most this many characters of text. */
export const THE_MOST_LINES_OF_A_RUN = 500;
export const A_LINE_IS_AT_MOST = 500;

const theLines = [];
let theDroppedLines = 0;

/** The values of the module's secrets (Tommos names them in TOMMOS_SECRET_NAMES), and the query of each address,
 *  taken out of a text before it is kept. */
export function withoutSecrets(text) {
  let t = String(text ?? "");
  for (const name of (process.env.TOMMOS_SECRET_NAMES ?? "").split(",").filter(Boolean)) {
    const v = process.env[name];
    if (v && v.length >= 4) t = t.split(v).join("[secret]");
  }
  return t.replace(/(https?:\/\/[^\s?#"'<>]+)\?[^\s#"'<>]*/gi, "$1?[query]");
}

const keep = (line) => {
  if (theLines.length >= THE_MOST_LINES_OF_A_RUN) {
    theDroppedLines++;
    return;
  }
  theLines.push(line);
};
const words = (v, max = A_LINE_IS_AT_MOST) => withoutSecrets(typeof v === "string" ? v : JSON.stringify(v)).slice(0, max);

/**
 * The module's own lines of the log, of three kinds only:
 *   log.read(where, count): what it read and how much («Contracts Finder, the notices of 10 November», 20);
 *   log.skipped(key, reason): a record it dropped, and why («ocds-b5fd17-…», «past its due date»);
 *   log.warning(text): something a person should know («page 3 answered 503; the run took pages 1 and 2»).
 */
export const log = {
  read(where, count) {
    keep({ kind: "read", where: words(where, 300), count: Number.isFinite(Number(count)) ? Number(count) : null });
  },
  skipped(key, reason) {
    keep({ kind: "skipped", key: words(key, 300), reason: words(reason) });
  },
  warning(text) {
    keep({ kind: "warning", text: words(text) });
  },
};
/** The lines this run wrote, and how many past the cap were not kept. */
export const theLinesOfTheLog = () => ({ lines: [...theLines], dropped: theDroppedLines });

// ---------------------------------------------------------------- the domain, the date and the key

/** A company's domain: lower case, no www, no port, no path; null when it is not a domain. */
export function aDomain(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  let s = v.trim().toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
  let host;
  try {
    host = new URL(s).hostname;
  } catch {
    return null;
  }
  host = host.replace(/\.$/, "").replace(/^www\d?\./, "");
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host) ? host : null;
}

/** A day as YYYY-MM-DD (UTC), from an ISO date or time, an email date, or a Date; null when it is none. */
export function aDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    const d = new Date(`${v.trim()}T00:00:00Z`);
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v.trim() ? null : v.trim();
  }
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** A record's key from its parts: the parts joined by «:»; a key longer than 200 characters is its SHA-256. */
export function aKey(...parts) {
  const k = parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(":");
  if (!k) throw new ContractError(["the key is empty"], null);
  return k.length <= 200 ? k : createHash("sha256").update(k).digest("hex");
}

// ---------------------------------------------------------------- the builders

/** A record that fails its contract. `reasons` says why in words; `record` is what the builder made, so a module can
 *  still give it back and Tommos refuses it with its reasons in the run's log. */
export class ContractError extends Error {
  constructor(reasons, record) {
    super(`The record fails its contract: ${reasons.join("; ")}`);
    this.name = "ContractError";
    this.reasons = reasons;
    this.record = record;
  }
}

const clean = (o) => {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === "object") {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === null || v === undefined || v === "") continue;
      const c = clean(v);
      if (c && typeof c === "object" && !Array.isArray(c) && !Object.keys(c).length) continue;
      out[k] = c;
    }
    return out;
  }
  return typeof o === "string" ? o.trim() : o;
};

/** A bid as the contract Bid v1 holds it: empty fields dropped, dates made days; throws ContractError when it fails. */
export function aBid(fields) {
  const r = clean({ ...fields, due_date: aDate(fields?.due_date) ?? fields?.due_date, posted_date: aDate(fields?.posted_date) ?? fields?.posted_date });
  const reasons = theReasonsItFails(BID_V1, r);
  if (reasons.length) throw new ContractError(reasons, r);
  return r;
}

/** A prospect as the contract Prospect v1 holds it: the domain made plain, each evidence's date a day; throws
 *  ContractError when it fails. */
export function aProspect(fields) {
  const evidence = Array.isArray(fields?.evidence) ? fields.evidence.map((e) => ({ ...e, date: aDate(e?.date) ?? e?.date })) : fields?.evidence;
  const r = clean({ ...fields, domain: aDomain(fields?.domain) ?? fields?.domain, evidence });
  const reasons = theReasonsItFails(PROSPECT_V1, r);
  if (reasons.length) throw new ContractError(reasons, r);
  return r;
}

// ---------------------------------------------------------------- the cursor

/** The cursor Tommos gave this run, or `start` on the first run. A cursor is any JSON value the module chooses; Tommos
 *  keeps the one a run gives back only when the run worked. */
export const theCursor = (context, start = null) => (context && context.cursor !== undefined && context.cursor !== null ? context.cursor : start);

// ---------------------------------------------------------------- the model, through Tommos (MOD-01.3)

/** A call of «ask» Tommos refused: over the run's calls, over the day's spend, or no model runs for the workspace. */
export class AskRefused extends Error {
  constructor(message) {
    super(message);
    this.name = "AskRefused";
  }
}
let theAnswersAsked = 0;

/**
 * Ask a model through Tommos: `{ class: "fast" | "smart", system?, prompt, maxTokens?, json? }`. The module names the
 * class of the task; Tommos picks the model of that class from its tested list and calls it on its own key, with the
 * pass of this run, which the sandbox's firewall puts on the call: no pass, no key and no model name stand in a module. While Tommos runs the examples, the
 * answers come from responses.json, `"ask"`, one after another.
 */
export async function ask(o) {
  if (o?.class !== "fast" && o?.class !== "smart") throw new AskRefused("ask needs the class of the task: «fast» or «smart»");
  if (typeof o.prompt !== "string" || !o.prompt.trim()) throw new AskRefused("ask needs a prompt");
  const answers = theAnswersOfTheExample();
  if (answers) {
    const list = Array.isArray(answers.map.ask) ? answers.map.ask : [];
    const a = list[theAnswersAsked++];
    if (!a) throw new AskRefused("This example holds no answer of «ask» for this call: add one to responses.json, \"ask\": [{ \"text\": \"...\" }]");
    return { text: String(a.text ?? ""), ...(o.json ? { json: a.json ?? JSON.parse(String(a.text ?? "null")) } : {}) };
  }
  const url = process.env.TOMMOS_ASK_URL;
  if (!url) throw new AskRefused("This run has no door to ask a model: the manifest names max_model_calls_per_run 0");
  const r = await globalThis.fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ class: o.class, system: o.system ?? null, prompt: o.prompt, maxTokens: o.maxTokens ?? 1000, json: Boolean(o.json) }), signal: AbortSignal.timeout(120_000) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.ok) throw new AskRefused(String(body.reason ?? `Tommos answered ${r.status}`));
  return { text: String(body.text ?? ""), ...(o.json ? { json: body.json ?? null } : {}) };
}

// ---------------------------------------------------------------- the fetch

const hostsAllowed = () => (process.env.TOMMOS_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
const aHostIsAllowed = (host, allowed) => allowed.some((a) => (a.startsWith("*.") ? host === a.slice(2) || host.endsWith(a.slice(1)) : host === a));
const lastCallAt = new Map();
const theHostsAsked = new Set();
/** Each host the module asked for in this run, reached or refused (the check's item h reads it). */
export const theHostsThisRunAsked = () => [...theHostsAsked].sort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The answers an example carries (`examples/<name>/responses.json`), read once, when Tommos runs the examples. */
let theAnswers;
function theAnswersOfTheExample() {
  if (theAnswers !== undefined) return theAnswers;
  const file = process.env.TOMMOS_RESPONSES;
  theAnswers = file ? { dir: dirname(file), map: JSON.parse(readFileSync(file, "utf8")) } : null;
  return theAnswers;
}

class AnAnswer {
  constructor(url, status, body, headers = {}) {
    this.url = url;
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.headers = headers;
    this._body = body;
  }
  text() {
    return this._body;
  }
  json() {
    return JSON.parse(this._body);
  }
}

/** A refusal of the fetch: the host is not in the manifest, or the source did not answer after the tries. */
export class FetchError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "FetchError";
    this.status = status;
  }
}

/**
 * Fetch a URL. Only a host of the manifest is reached; any other is refused before a call. A call waits `waitMs` after
 * the last call to the same host. A 429, a 5xx or no answer is tried again, `tries` times in all, with a longer wait
 * each time. Answers `{ status, ok, text(), json() }`; any status that is not tried again is answered as it is.
 * While Tommos runs the examples, the answers come from `responses.json`, and a URL it does not hold is refused.
 */
export async function fetch(url, o = {}) {
  const { tries = 3, waitMs = 500, timeoutMs = 30_000, headers = {}, method = "GET", body } = o;
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new FetchError(`«${url}» is not a link`);
  }
  const allowed = hostsAllowed();
  theHostsAsked.add(host);
  if (!aHostIsAllowed(host, allowed)) throw new FetchError(`The manifest does not name the host ${host}: it names ${allowed.join(", ") || "no host"}`);

  const answers = theAnswersOfTheExample();
  if (answers) {
    const a = answers.map[url];
    if (!a) throw new FetchError(`This example holds no answer for ${url}`);
    const text = a.file ? readFileSync(join(answers.dir, a.file), "utf8") : typeof a.body === "string" ? a.body : JSON.stringify(a.body ?? "");
    return new AnAnswer(url, a.status ?? 200, text, a.headers ?? {});
  }

  let why = "";
  for (let t = 1; t <= tries; t++) {
    const wait = (lastCallAt.get(host) ?? 0) + waitMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt.set(host, Date.now());
    try {
      const r = await globalThis.fetch(url, { method, body, headers: { "user-agent": "Tommos module (+https://tommos.ai)", ...headers }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
      const final = new URL(r.url || url).hostname.toLowerCase();
      if (!aHostIsAllowed(final, allowed)) throw new FetchError(`${host} sent the call on to ${final}, a host the manifest does not name`);
      if (r.status === 429 || r.status >= 500) {
        why = `${host} answered ${r.status}`;
      } else {
        return new AnAnswer(url, r.status, await r.text(), Object.fromEntries(r.headers));
      }
    } catch (e) {
      if (e instanceof FetchError) throw e;
      why = `${host} did not answer (${e instanceof Error ? e.message : String(e)})`;
    }
    if (t < tries) await sleep(1000 * t);
  }
  throw new FetchError(`${why}, ${tries} times`);
}
