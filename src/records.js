// The records a run gives back, judged by Tommos (MOD-01.1 items 5 to 7): each against the contract of its kind, each
// by its identity (one record per source and key), each bid from a source the manifest names.

import { THE_KINDS_OF_A_FACT, theContractOf, theIdentityOf } from "./contracts.js";
import { theReasonsItFails } from "./schema.js";
import { THE_SOURCES_OF_TOMMOS } from "./manifest.js";

/** At most this many records are taken from one run; the rest wait for the next run of the cursor. */
export const THE_MOST_RECORDS_OF_A_RUN = 5000;

/** At most this many lines of the module are kept of a run (MOD-02.2 item 7). */
export const THE_LINES_A_RUN_KEEPS = 500;
const AT_MOST = 500;

/** Take out the values of secrets and the query of each address (MOD-02.2 item 7). Pure. */
export function withoutTheSecrets(v, secrets = [], max = 2000) {
  return plain(v, secrets, max);
}
function plain(v, secrets, max = AT_MOST) {
  let t = String(v ?? "");
  for (const s of secrets) if (s && s.length >= 4) t = t.split(s).join("[secret]");
  return t.replace(/(https?:\/\/[^\s?#"'<>]+)\?[^\s#"'<>]*/gi, "$1?[query]").slice(0, max);
}

// implements MOD-02.2
/**
 * The module's own lines as Tommos keeps them: of three kinds only (read, skipped, warning), each cut to its length,
 * with the values of the secrets and the query of each address taken out again, at most THE_LINES_A_RUN_KEEPS. A line
 * of another kind is not kept, and is counted. Pure.
 */
export function theLinesOfAModule(raw, secrets = []) {
  const lines = [];
  let refused = 0;
  for (const l of Array.isArray(raw) ? raw : []) {
    if (lines.length >= THE_LINES_A_RUN_KEEPS) break;
    if (!l || typeof l !== "object") {
      refused++;
      continue;
    }
    if (l.kind === "read" && typeof l.where === "string") lines.push({ kind: "read", where: plain(l.where, secrets, 300), count: Number.isFinite(Number(l.count)) && l.count !== null ? Number(l.count) : null });
    else if (l.kind === "skipped" && typeof l.reason === "string") lines.push({ kind: "skipped", key: plain(l.key, secrets, 300), reason: plain(l.reason, secrets) });
    else if (l.kind === "warning" && typeof l.text === "string") lines.push({ kind: "warning", text: plain(l.text, secrets) });
    else refused++;
  }
  return { lines, refused, cut: Math.max(0, (Array.isArray(raw) ? raw.length : 0) - lines.length - refused) };
}

/** What a run gave back, as Tommos reads it: `{ records, cursor }`, or why it is not that. */
export function theOutputOfARun(raw, secrets = []) {
  let o = raw;
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw);
    } catch {
      return { ok: false, why: "The run gave back no JSON" };
    }
  }
  if (!o || typeof o !== "object") return { ok: false, why: "The run gave back nothing" };
  const log = theLinesOfAModule(o.log, secrets);
  if (o.error) return { ok: false, why: `«find» stopped: ${plain(o.error, secrets, 1000)}`, log: log.lines };
  if (!Array.isArray(o.records)) return { ok: false, why: "«find» must give back { records: [...], cursor }", log: log.lines };
  if (o.records.length > THE_MOST_RECORDS_OF_A_RUN) return { ok: false, why: `«find» gave back ${o.records.length} records; a run may give at most ${THE_MOST_RECORDS_OF_A_RUN}` };
  const asked = Array.isArray(o.asked) ? o.asked.filter((h) => typeof h === "string").slice(0, 100) : [];
  return { ok: true, records: o.records, cursor: o.cursor === undefined ? null : o.cursor, log: log.lines, linesRefused: log.refused, linesCut: log.cut + (Number(o.dropped) || 0), asked };
}

// implements MOD-01.1
/**
 * Each record of a run judged: a good one with its identity, or a refused one with its reasons in words. A record that
 * stands twice in one run is taken once (the last), and counted as the same again.
 */
/** A query parameter whose name says it carries a credential. */
const A_CREDENTIAL_IN_A_LINK = /[?&](?:api[_-]?key|apikey|key|token|access[_-]?token|auth|secret|password|passwd|signature|sig|x-amz-signature|x-goog-signature)=/i;

// implements MOD-01.1, MOD-02.1
/**
 * The facts of a record against the facts its manifest names: a fact the manifest does not name is refused, and so is a
 * value of the wrong kind. Each reason in words, with the fact's key. Pure.
 */
export function theFactsOfARecordFail(manifest, record) {
  const facts = record && typeof record === "object" ? record.facts : undefined;
  if (facts === undefined || facts === null || typeof facts !== "object" || Array.isArray(facts)) return [];
  const named = new Map((manifest.facts ?? []).map((f) => [f.key, f]));
  const out = [];
  for (const [key, value] of Object.entries(facts)) {
    const f = named.get(key);
    if (!f) {
      out.push(`facts.${key} is not a fact the manifest names (${named.size ? `it names ${[...named.keys()].join(", ")}` : "it names none"})`);
      continue;
    }
    if (value === null || value === undefined) continue;
    const reasons = theReasonsItFails(THE_KINDS_OF_A_FACT[f.kind], value, `facts.${key}`);
    if (reasons.length) out.push(`facts.${key} is not a value of the kind ${f.kind}: ${reasons.join("; ")}`);
  }
  return out;
}

export function theRecordsJudged(manifest, records, o = {}) {
  const secrets = (o.secrets ?? []).filter((s) => typeof s === "string" && s.length >= 4);
  const contract = theContractOf(manifest.kind, manifest.contract.version);
  const sources = manifest.record_sources ?? [manifest.name];
  const byIdentity = new Map();
  const refused = [];
  let sameInTheRun = 0;
  for (const record of records) {
    const reasons = contract ? theReasonsItFails(contract, record) : [`Tommos holds no contract ${manifest.kind} v${manifest.contract.version}`];
    if (manifest.kind === "bid" && record && typeof record.source === "string" && !sources.includes(record.source)) reasons.push(`source «${record.source}» is not one of the manifest's record_sources (${sources.join(", ")})`);
    if (manifest.kind === "bid" && record && THE_SOURCES_OF_TOMMOS.includes(record.source)) reasons.push(`source «${record.source}» is a source of Tommos itself`);
    // implements MOD-02.1
    reasons.push(...theFactsOfARecordFail(manifest, record));
    // implements MOD-02.2
    // A record carries no secret: neither the value of one of the source's secrets, nor a link with a credential in it.
    const text = JSON.stringify(record ?? null);
    if (secrets.some((s) => text.includes(s))) reasons.push("the record carries the value of a secret of the source");
    if (A_CREDENTIAL_IN_A_LINK.test(text)) reasons.push("the record carries a link with a credential in its query (such as ?token=); give the link without it");
    const identity = theIdentityOf(manifest.kind, record, manifest.name);
    if (reasons.length || !identity) {
      refused.push({ record, identity, reasons: reasons.length ? reasons : ["the record has no key"] });
      continue;
    }
    const k = `${identity.source}\u0000${identity.key}`;
    if (byIdentity.has(k)) sameInTheRun++;
    byIdentity.set(k, { record, identity });
  }
  return { good: [...byIdentity.values()], refused, sameInTheRun };
}
