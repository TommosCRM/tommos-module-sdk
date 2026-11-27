// The manifest of a module (MOD-01.1 item 2): read, and checked against the contract of a manifest.

import { MANIFEST_V1, theContractOf } from "./contracts.js";
import { theReasonsItFails } from "./schema.js";

/** The sources a module may never name: the doors Tommos keeps itself (MOD-01.1: a module writes only under its own
 *  source). A record of one of them would stand as that door's. */
// «by-hand» is the source of a bid a person makes on the board «Bids» (BID-01.1 item 14): no module writes under it.
export const THE_SOURCES_OF_TOMMOS = ["highergov", "by-hand"];

/** The manifest as Tommos takes it, or the reasons it is refused, in words. A bid module names the sources its records
 *  come from (`record_sources`); a prospect module's records come from the module itself. */
// implements MOD-02.1
/** The domains Tommos itself runs on: its app, its database, its platform. A module reaches none of them. */
export const THE_DOMAINS_OF_TOMMOS = ["tommos.ai", "supabase.co", "supabase.in", "vercel.app", "vercel.com"];

/** True when a host the manifest names is, or as a wildcard covers, a host of Tommos (check a; the firewall too). */
export function aHostOfTommos(host) {
  const h = String(host).toLowerCase().replace(/\.$/, "");
  const bare = h.startsWith("*.") ? h.slice(2) : h;
  return THE_DOMAINS_OF_TOMMOS.some((d) => bare === d || bare.endsWith(`.${d}`) || (h.startsWith("*.") && d.endsWith(`.${bare}`)));
}

export function readTheManifest(raw) {
  let m = raw;
  if (typeof raw === "string") {
    try {
      m = JSON.parse(raw);
    } catch (e) {
      return { ok: false, reasons: [`manifest.json is not JSON (${e instanceof Error ? e.message : String(e)})`] };
    }
  }
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, reasons: ["manifest.json must hold an object"] };
  const reasons = theReasonsItFails(MANIFEST_V1, m).map((r) => `manifest: ${r}`);
  if (!reasons.length && !theContractOf(m.kind, m.contract.version)) reasons.push(`manifest: Tommos holds no contract ${m.kind} v${m.contract.version}`);
  if (!reasons.length && m.kind === "bid" && !m.record_sources) reasons.push("manifest: record_sources is missing (a bid module names the sources its bids come from)");
  if (!reasons.length && m.kind === "prospect" && m.record_sources && (m.record_sources.length !== 1 || m.record_sources[0] !== m.name)) reasons.push("manifest: a prospect module's records come from the module itself; leave record_sources out");
  // implements MOD-01.1
  for (const h of m.hosts ?? []) if (aHostOfTommos(h)) reasons.push(`manifest: ${h} is a host of Tommos itself: a module reaches no host of Tommos (it asks a model through the tool «ask»)`);
  for (const s of [...(m.record_sources ?? []), m.name]) if (THE_SOURCES_OF_TOMMOS.includes(s)) reasons.push(`manifest: «${s}» is a source of Tommos itself; a module writes only under a source of its own`);
  const names = (m.secrets ?? []).map((s) => s?.name);
  if (new Set(names).size !== names.length) reasons.push("manifest: a secret is named twice");
  // implements MOD-01.1
  // Each fact is named once; a record of a bid has no place for facts (the contract of a bid carries none).
  const keys = (m.facts ?? []).map((f) => f?.key);
  for (const k of new Set(keys.filter((k, i) => keys.indexOf(k) !== i))) reasons.push(`manifest: the fact «${k}» is named twice`);
  if (m.kind === "bid" && m.facts?.length) reasons.push("manifest: a bid module names no facts; the contract of a bid carries none");
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, manifest: { ...m, record_sources: m.record_sources ?? [m.name] } };
}

// implements MOD-02.1
/**
 * A new version keeps the kind of each fact the version that ran named: a fact whose kind changes is refused, in words.
 * A fact may be added or left out; its key, once named, keeps its kind. `before` is the manifest of the version that
 * ran (null for a new module). Pure.
 */
export function theFactsKeepTheirKinds(before, after) {
  const was = new Map((before?.facts ?? []).map((f) => [f.key, f.kind]));
  return (after?.facts ?? [])
    .filter((f) => was.has(f.key) && was.get(f.key) !== f.kind)
    .map((f) => `manifest: the fact «${f.key}» is ${was.get(f.key)} in the version that runs, and ${f.kind} in this one. A fact keeps its kind; name a new fact for the new kind`);
}
