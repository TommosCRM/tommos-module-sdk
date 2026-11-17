// The check of a module (MOD-02.1 item 1, checks a to i; MOD-01.2 items 4, 5). One function, from the tools: the CLI
// (`tommos-module check`) runs it on a laptop and in the module's GitHub workflow, and Tommos runs it in a sandbox when
// a person adds a module or a version of it. The check in Tommos decides: there (`strict`) the checks g, h and i
// refuse; on a laptop they only warn, because a laptop is not the sandbox. Each reason is words for a person.
//
//   The package:   a. the manifest   b. the function «find»   c. the tools, by a version, never copied
//   A run on each example, in the sandbox: d. each record holds its contract and carries «matched»
//   e. a line of what it read   f. the same keys from the same cursor   g. within the time of the manifest
//   h. no host the manifest does not name   i. no value of a secret in the output or the log

import { createHash } from "node:crypto";
import { readTheManifest, theFactsKeepTheirKinds } from "./manifest.js";
import { theOutputOfARun, theRecordsJudged } from "./records.js";

/** A package is a map of its files: a path inside the package (with «/») and its text. */
export const A_PACKAGE_IS_AT_MOST_BYTES = 2_000_000;
export const A_PACKAGE_HOLDS_AT_MOST_FILES = 300;

/** What a package keeps of the files of a repository or a zip: text files, out of dot folders (.git, .github) and
 *  node_modules; the rest is not the module. Answers the files, or why the package is refused. */
export function thePackageAsFiles(entries) {
  const files = {};
  let bytes = 0;
  for (const [path, text] of entries) {
    const p = path.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!p || p.endsWith("/")) continue;
    if (p.split("/").some((part) => part.startsWith(".") || part === "node_modules" || part === "__pycache__")) continue;
    if (typeof text !== "string") continue;
    bytes += Buffer.byteLength(text);
    files[p] = text;
  }
  if (Object.keys(files).length > A_PACKAGE_HOLDS_AT_MOST_FILES) return { ok: false, why: `The package holds more than ${A_PACKAGE_HOLDS_AT_MOST_FILES} files` };
  if (bytes > A_PACKAGE_IS_AT_MOST_BYTES) return { ok: false, why: `The package is larger than ${A_PACKAGE_IS_AT_MOST_BYTES / 1_000_000} MB of text` };
  return { ok: true, files };
}

/** The hash a file of the tools is known by: SHA-256 of its text, line ends made one. */
export const theHashOfAFile = (text) => createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");

const older = (a, b) => {
  const [x, y] = [a.split(".").map(Number), b.split(".").map(Number)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

// implements MOD-01.2, MOD-02.1
/**
 * Check c: the tools are taken as a package of the manifest's version, a version not older than the oldest one Tommos
 * takes (`oldest`), and no file of the tools is copied into the module: a file whose text is a file of the tools
 * (`toolHashes`, the hashes of the files of every version Tommos holds), or that stands where the tools stand.
 */
export function theToolsAreTakenAsAPackage(files, manifest, o = {}) {
  const reasons = [];
  const want = manifest.sdk.version;
  const copied = (p) => `${p}: a file of the tools of Tommos is copied into the module; take the tools as a package of version ${want}`;
  for (const p of Object.keys(files)) {
    if (/(^|\/)tommos_module\//.test(p) || /(^|\/)@tommos\/module-sdk\//.test(p)) reasons.push(copied(p));
    else if (o.toolHashes && files[p].length > 200 && o.toolHashes.has(theHashOfAFile(files[p]))) reasons.push(copied(p));
    else if (p.endsWith("package.json")) {
      try {
        if (JSON.parse(files[p]).name === "@tommos/module-sdk") reasons.push(copied(p));
      } catch {
        /* another package.json; read below */
      }
    }
  }
  if (o.oldest && older(want, o.oldest) < 0) reasons.push(`the module takes the tools ${want}; the oldest version Tommos takes is ${o.oldest}`);
  else if (o.versions && o.versions.length && !o.versions.includes(want)) reasons.push(`the tools ${want} are not a version Tommos holds; it holds ${o.versions.join(", ")}`);
  const asked = (spec) => {
    const m = /#v?(\d+\.\d+\.\d+)/.exec(spec) ?? /^[\^~=]?(\d+\.\d+\.\d+)$/.exec(spec.trim()) ?? /@v?(\d+\.\d+\.\d+)/.exec(spec);
    return m ? m[1] : null;
  };
  if (/\.(ts|mjs|js)$/.test(manifest.entry)) {
    let pkg = null;
    try {
      pkg = files["package.json"] ? JSON.parse(files["package.json"]) : null;
    } catch {
      reasons.push("package.json is not JSON");
    }
    const spec = pkg?.dependencies?.["@tommos/module-sdk"] ?? pkg?.devDependencies?.["@tommos/module-sdk"];
    if (!spec) reasons.push(`package.json must ask for the tools: "@tommos/module-sdk" at version ${want}`);
    else if (asked(String(spec)) !== want) reasons.push(`package.json asks for the tools at «${spec}», and the manifest names version ${want}`);
  } else {
    const req = files["requirements.txt"] ?? "";
    const line = req.split(/\r?\n/).find((l) => /tommos[-_]module[-_]sdk/i.test(l));
    if (!line) reasons.push(`requirements.txt must ask for the tools: tommos-module-sdk at version ${want}`);
    else if ((/==\s*v?(\d+\.\d+\.\d+)/.exec(line) ?? /@v?(\d+\.\d+\.\d+)/.exec(line))?.[1] !== want) reasons.push(`requirements.txt asks for the tools as «${line.trim()}», and the manifest names version ${want}`);
  }
  return reasons;
}

// implements MOD-02.1
/** Check b: the entry holds the function «find», with its one argument, the context. */
export function theFunctionFindIsThere(files, entry) {
  const text = files[entry] ?? "";
  const ok = entry.endsWith(".py") ? /^def find\(\s*\w+\s*(:[^,)]*)?\)/m.test(text) : /export\s+(async\s+)?function\s+find\s*\(\s*\w+/.test(text) || /export\s+const\s+find\s*=\s*(async\s*)?\(\s*\w+/.test(text);
  return ok ? [] : [`${entry} holds no function «find» with its argument, the context: ${entry.endsWith(".py") ? "def find(context):" : "export async function find(context) { ... }"}`];
}

/** The names of the examples a package carries: each folder `examples/<name>/` that holds `context.json`. */
export function theExamplesOf(files) {
  return [...new Set(Object.keys(files).map((p) => /^examples\/([^/]+)\/context\.json$/.exec(p)?.[1]).filter(Boolean))].sort();
}

/** The same JSON, whatever the order of an object's keys. */
const canonical = (v) => (Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);
const sameJson = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const theKeys = (judged) => judged.good.map((g) => `${g.identity.source}:${g.identity.key}`).sort();
const aHostIsNamed = (host, hosts) => hosts.some((a) => (a.startsWith("*.") ? host === a.slice(2) || host.endsWith(a.slice(1)) : host === a));

/** The hosts of the model providers (MOD-01.3 item 6): a module asks a model only through the tool «ask», so its
 *  manifest names none of them. */
export const THE_HOSTS_OF_MODEL_PROVIDERS = ["api.anthropic.com", "api.openai.com", "generativelanguage.googleapis.com", "api.mistral.ai", "api.cohere.com", "api.cohere.ai", "api.groq.com", "openrouter.ai", "api.together.xyz", "api.deepseek.com", "api.x.ai", "api.perplexity.ai", "api.fireworks.ai", "ai-gateway.vercel.sh", "bedrock-runtime.amazonaws.com", "aiplatform.googleapis.com", "openai.azure.com"];
/** The shape of a key of a model: a secret's value, or a secret's name, that is one is refused (MOD-01.3 item 6). */
export const A_KEY_OF_A_MODEL = /^(sk-ant-|sk-proj-|sk-or-|sk-[A-Za-z0-9]{20,}|gsk_|xai-|AIza[0-9A-Za-z_-]{30,}|pplx-|fw_)/;
export const A_NAME_OF_A_KEY_OF_A_MODEL = /(ANTHROPIC|OPENAI|GEMINI|GOOGLE_AI|MISTRAL|COHERE|GROQ|OPENROUTER|TOGETHER|DEEPSEEK|XAI|PERPLEXITY|FIREWORKS|AI_GATEWAY|CLAUDE|GPT)/;

// implements MOD-01.3
/** Checks j and k: the manifest names no host of a model provider, and no secret that is a key of a model. */
export function theModelIsAskedOnlyThroughTommos(manifest) {
  const out = [];
  const provider = (h) => THE_HOSTS_OF_MODEL_PROVIDERS.some((p) => h === p || h.endsWith(`.${p}`) || (h.startsWith("*.") && p.endsWith(h.slice(1))));
  for (const h of manifest.hosts ?? []) if (provider(h)) out.push({ check: "j", said: `the manifest names ${h}, a host of a model provider: a module asks a model only through the tool «ask», on the key of Tommos` });
  for (const s of manifest.secrets ?? []) if (A_NAME_OF_A_KEY_OF_A_MODEL.test(s.name)) out.push({ check: "k", said: `the secret ${s.name} is a key of a model: a module asks a model only through the tool «ask», and needs no key of its own` });
  return out;
}

/** The short name of each check of MOD-02.1 item 1, as a screen lists a failed one. */
export const THE_CHECKS = {
  a: "The manifest",
  b: "The function find",
  c: "The tools",
  d: "The records",
  e: "The line of what it read",
  f: "The same keys again",
  g: "The time",
  h: "The hosts",
  i: "The secrets",
  j: "The hosts of a model",
  k: "The key of a model",
  examples: "The examples",
};

/** The values the check gives the secrets of the manifest, so check i can find one that leaks. */
export function theSecretsOfTheCheck(manifest) {
  return Object.fromEntries((manifest.secrets ?? []).map((s) => [s.name, `tommos-check-${s.name.toLowerCase()}-${createHash("sha256").update(s.name).digest("hex").slice(0, 12)}`]));
}

/**
 * Check a package. `run` runs one example of it and answers `{ ok: true, output, ms }` (the JSON the runner wrote, and
 * how long it ran) or `{ ok: false, error, ms }`; it is called with `{ files, manifest, entry, example, context,
 * secrets }`. Options: `entry` checks another entry than the manifest's (the reference module has a find.ts and a
 * find.py); `strict` refuses on g, h and i (Tommos), else they warn (a laptop); `versions`, `oldest` and `toolHashes`
 * are the versions of the tools Tommos holds and the hashes of their files (check c); `before` is the manifest of the
 * version that runs, for a new version (each fact keeps its kind).
 */
export async function checkAPackage(files, run, o = {}) {
  const out = { ok: false, manifest: null, reasons: [], warnings: [], examples: [], failed: [] };
  const fail = (check, said, ex = null) => {
    (ex ? ex.reasons : out.reasons).push(said);
    out.failed.push({ check, name: THE_CHECKS[check], said: ex ? `the example «${ex.name}»: ${said}` : said });
  };
  // a. The manifest matches its schema; Tommos knows its kind and the version of its contract.
  if (!files["manifest.json"]) {
    fail("a", "The package holds no manifest.json at its root");
    return out;
  }
  const read = readTheManifest(files["manifest.json"]);
  if (!read.ok) {
    for (const r of read.reasons) fail("a", r);
    return out;
  }
  const manifest = o.entry ? { ...read.manifest, entry: o.entry } : read.manifest;
  out.manifest = read.manifest;
  // implements MOD-02.1
  // A new version keeps the kind of each fact the version that runs names (`before`, its manifest).
  if (o.before) for (const r of theFactsKeepTheirKinds(o.before, manifest)) fail("a", r);
  if (out.reasons.length) return out;
  // b. The function «find» is there, with its signature.
  if (!files[manifest.entry]) fail("b", `The manifest names the entry ${manifest.entry}, and the package does not hold it`);
  else for (const r of theFunctionFindIsThere(files, manifest.entry)) fail("b", r);
  // c. The tools are a package of a version Tommos takes, and none of them is copied in.
  for (const r of theToolsAreTakenAsAPackage(files, manifest, o)) fail("c", r);
  for (const r of theModelIsAskedOnlyThroughTommos(manifest)) fail(r.check, r.said);
  const examples = theExamplesOf(files);
  if (!examples.length) fail("examples", "The package carries no example: each example is a folder examples/<name>/ with context.json, responses.json and expected.json");
  if (out.reasons.length) return out;

  const secrets = theSecretsOfTheCheck(manifest);
  const marks = Object.values(secrets);
  const limitMs = manifest.time_limit_seconds * 1000;
  const strictly = (check, ex, words) => (o.strict ? fail(check, words, ex) : out.warnings.push(`the example «${ex.name}»: ${words}`));

  for (const name of examples) {
    const ex = { name, ok: false, records: 0, reasons: [] };
    out.examples.push(ex);
    let context;
    let expected = null;
    try {
      context = JSON.parse(files[`examples/${name}/context.json`]);
      if (files[`examples/${name}/expected.json`]) expected = JSON.parse(files[`examples/${name}/expected.json`]);
    } catch (e) {
      fail("examples", `a file of the example is not JSON (${e instanceof Error ? e.message : String(e)})`, ex);
      continue;
    }
    if (!expected) fail("examples", "the example holds no expected.json", ex);
    const runs = [];
    for (let i = 0; i < 2; i++) {
      const r = await run({ files, manifest, entry: manifest.entry, example: name, context, secrets });
      // g. The run ends in the time of the manifest.
      if (typeof r.ms === "number" && r.ms > limitMs) strictly("g", ex, `the run took ${(r.ms / 1000).toFixed(1)} s, past the ${manifest.time_limit_seconds} s the manifest gives it`);
      if (!r.ok) {
        fail(/did not end within/.test(r.error) ? "g" : "examples", `the run ${i === 0 ? "" : "again "}failed: ${r.error}`, ex);
        break;
      }
      // i. No value of a secret stands in the output or in the log.
      const leaked = Object.entries(secrets).filter(([, v]) => r.output.includes(v)).map(([k]) => k);
      if (leaked.length) strictly("i", ex, `the value of the secret ${leaked.join(", ")} stands in the output or the log: use the tools' log, which takes it out, and never give a secret back in a record`);
      const output = theOutputOfARun(r.output, marks);
      if (!output.ok) {
        fail("examples", output.why, ex);
        break;
      }
      runs.push(output);
    }
    if (runs.length < 2) continue;
    // d. Each record matches its contract and carries «matched».
    const judged = theRecordsJudged(manifest, runs[0].records, { secrets: marks });
    ex.records = runs[0].records.length;
    if (!runs[0].records.length) fail("d", "the example found no record: an example proves the module with at least one", ex);
    for (const r of judged.refused) fail("d", `a record fails its contract (${r.identity ? `${r.identity.source}:${r.identity.key}` : "no key"}): ${r.reasons.join("; ")}`, ex);
    if (expected && expected.records !== undefined && !sameJson(runs[0].records, expected.records)) fail("examples", "the records are not the ones expected.json holds", ex);
    if (expected && expected.cursor !== undefined && !sameJson(runs[0].cursor, expected.cursor)) fail("examples", "the cursor is not the one expected.json holds", ex);
    // e. The module writes at least one line of what it read.
    if (!runs[0].log.some((l) => l.kind === "read")) fail("e", "the module writes no line of what it read: call log.read(where, count) for each page or feed it reads", ex);
    if (runs[0].linesRefused) fail("e", `the module wrote ${runs[0].linesRefused} line${runs[0].linesRefused === 1 ? "" : "s"} of a kind the log does not hold: use log.read, log.skipped or log.warning`, ex);
    // f. A second run from the same cursor gives the same keys.
    const again = theRecordsJudged(manifest, runs[1].records);
    if (!sameJson(theKeys(judged), theKeys(again))) fail("f", "a second run from the same cursor gave other keys: a module must give the same records for the same answers", ex);
    // h. The run reaches no host the manifest does not name.
    const strange = [...new Set(runs.flatMap((r) => r.asked ?? []))].filter((h) => !aHostIsNamed(h, manifest.hosts));
    if (strange.length) strictly("h", ex, `the run asked for ${strange.join(", ")}, which the manifest does not name in hosts`);
    ex.ok = !ex.reasons.length;
  }
  out.ok = out.examples.length > 0 && out.examples.every((e) => e.ok);
  return out;
}

/** Each failed check of a module in words, for a person; or the one sentence of a module that passed. */
export function theCheckInWords(check) {
  if (check.ok) return `The module «${check.manifest.name}» passed its check on ${check.examples.length} example${check.examples.length === 1 ? "" : "s"}.`;
  const each = [...check.reasons, ...check.examples.filter((e) => !e.ok).flatMap((e) => e.reasons.map((r) => `the example «${e.name}»: ${r}`))];
  const unique = [...new Set(each)];
  return `The module is not added. ${unique.length === 1 ? "One check failed" : `${unique.length} checks failed`}: ${unique.join("; ")}.`.replace(/\.\.$/, ".");
}
