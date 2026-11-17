// The contracts of the records a module gives back (MOD-01.1 item 6), and the contract of a manifest (item 2).
// Each is a JSON Schema (a small subset: the one `schema.js` reads). The same schemas stand as plain JSON in
// `contracts/` of this package, in the Python package, and at https://app.tommos.ai/modules/contracts/ — written from
// this file by `scripts/write-the-contracts.mjs`, and a check in the CRM fails when a copy differs.

const A_SOURCE = "^[a-z0-9][a-z0-9-]{1,62}$";
const A_DOMAIN = "^(?!www\\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$";
const A_HOST = "^(?:\\*\\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$";
const A_COUNTRY = "^[A-Z]{2}$";
const text = (max, min = 1) => ({ type: "string", minLength: min, maxLength: max });

// implements MOD-01.1
// A module names its facts in its manifest: at most six, each with a key, a label and a kind. The kinds are text,
// money, count and date. A record carries a value for each fact it knows (Yuri, 2026-11-17).
/** The most facts a manifest names. */
export const THE_MOST_FACTS_OF_A_MODULE = 6;
/** The key of a fact: lower case, a letter first, as a record names it. */
const A_FACT_KEY = "^[a-z][a-z0-9_]{0,39}$";
/** The kinds of a fact, and the value a record gives for each. */
export const THE_KINDS_OF_A_FACT = {
  text: { ...text(300), description: "A text: «Seed»." },
  money: {
    type: "object",
    additionalProperties: false,
    required: ["amount", "currency"],
    properties: { amount: { type: "number", minimum: 0 }, currency: { type: "string", pattern: "^[A-Z]{3}$" } },
    description: "An amount and its currency, ISO 4217: { \"amount\": 2000000, \"currency\": \"USD\" }.",
  },
  count: { type: "integer", minimum: 0, description: "A whole number: 12." },
  date: { type: "string", format: "date", description: "A day, YYYY-MM-DD." },
};

/** The contract of a bid, version 1: what the door of bids (`bring_in_a_bid`, BID-01.1) reads. */
export const BID_V1 = {
  $id: "https://app.tommos.ai/modules/contracts/bid.v1.json",
  title: "Bid",
  version: 1,
  type: "object",
  additionalProperties: false,
  required: ["source", "key", "title", "buyer", "source_url", "matched"],
  properties: {
    source: { type: "string", pattern: A_SOURCE, description: "The source the bid comes from, one of the manifest's record_sources." },
    key: { ...text(200), description: "The bid's own id at its source, such as the notice id." },
    matched: { ...text(300), description: "The rule of the module that took this record, as a fact: «CPV 72254, software testing»." },
    title: text(500),
    buyer: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: text(300), key: text(200), type: text(100) },
    },
    contact_email: { type: "string", format: "email", maxLength: 320 },
    due_date: { type: "string", format: "date" },
    posted_date: { type: "string", format: "date" },
    source_url: { type: "string", format: "uri", maxLength: 2000, description: "The notice on the source's own site." },
    summary: text(20000),
    description: text(100000),
    documents: {
      type: "array",
      maxItems: 100,
      items: { type: "object", additionalProperties: false, required: ["name", "url"], properties: { name: text(300), url: { type: "string", format: "uri", maxLength: 2000 } } },
    },
    value_estimate: {
      type: "object",
      additionalProperties: false,
      required: ["currency"],
      properties: { low: { type: "number", minimum: 0 }, high: { type: "number", minimum: 0 }, currency: { type: "string", pattern: "^[A-Z]{3}$" } },
    },
    country: { type: "string", pattern: A_COUNTRY, description: "The country of the buyer, ISO 3166 alpha-2: GB, US." },
    naics: text(50),
    cpv: { type: "array", maxItems: 50, items: text(20) },
    opp_type: text(200),
    place: { type: "object", additionalProperties: false, properties: { city: text(200), region: text(200) } },
  },
};

/** The contract of a prospect, version 1: a company a module found (MOD-03.1). */
export const PROSPECT_V1 = {
  $id: "https://app.tommos.ai/modules/contracts/prospect.v1.json",
  title: "Prospect",
  version: 1,
  type: "object",
  additionalProperties: false,
  required: ["domain", "name", "evidence", "matched"],
  properties: {
    domain: { type: "string", pattern: A_DOMAIN, maxLength: 253, description: "The company's own website: lower case, no www, no path." },
    name: text(300),
    matched: { ...text(300), description: "The rule of the module that took this company, as a fact: «a Show HN launch with its own website»." },
    evidence: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["what", "url"],
        properties: { what: text(500), url: { type: "string", format: "uri", maxLength: 2000 }, date: { type: "string", format: "date" }, quote: text(1000) },
      },
    },
    segment: text(100),
    score: { type: "number" },
    facts: {
      type: "object",
      description: "The value of each fact the manifest names that the record knows, by the fact's key: a text for text, { amount, currency } for money, a whole number for count, YYYY-MM-DD for date. A key the manifest does not name, or a value of another kind, is refused.",
    },
    country: { type: "string", pattern: A_COUNTRY },
    people: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: { name: text(200), title: text(200), email: { type: "string", format: "email", maxLength: 320 }, url: { type: "string", format: "uri", maxLength: 2000 } },
      },
    },
  },
};

/** The contract of a manifest, version 1 (MOD-01.1 item 2). */
export const MANIFEST_V1 = {
  $id: "https://app.tommos.ai/modules/contracts/manifest.v1.json",
  title: "Manifest",
  version: 1,
  type: "object",
  additionalProperties: false,
  required: ["manifest_version", "name", "title", "kind", "contract", "entry", "sdk", "schedule", "secrets", "hosts", "time_limit_seconds"],
  properties: {
    manifest_version: { const: 1 },
    name: { type: "string", pattern: A_SOURCE },
    title: text(120),
    about: text(1000),
    kind: { enum: ["bid", "prospect"] },
    contract: { type: "object", additionalProperties: false, required: ["version"], properties: { version: { const: 1 } } },
    entry: { type: "string", pattern: "^find\\.(ts|mjs|js|py)$" },
    sdk: { type: "object", additionalProperties: false, required: ["version"], properties: { version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" } } },
    schedule: { type: "object", additionalProperties: false, required: ["every_minutes"], properties: { every_minutes: { type: "integer", minimum: 60, maximum: 10080 } } },
    secrets: {
      type: "array",
      maxItems: 10,
      items: { type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string", pattern: "^(?!TOMMOS_)[A-Z][A-Z0-9_]{1,63}$" }, about: text(300) } },
    },
    hosts: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", pattern: A_HOST, maxLength: 253 } },
    time_limit_seconds: { type: "integer", minimum: 10, maximum: 200, description: "How long one run may take: at most 200 s, so the run, the sandbox and the work after it fit a call of Tommos." },
    max_model_calls_per_run: { type: "integer", minimum: 0, maximum: 100, description: "The most calls of the tool «ask» one run may make; 0, or left out, when the module asks no model." },
    record_sources: { type: "array", minItems: 1, maxItems: 10, items: { type: "string", pattern: A_SOURCE } },
    facts: {
      type: "array",
      maxItems: THE_MOST_FACTS_OF_A_MODULE,
      description: "The facts a record of this module carries, at most six, in the order a screen shows them: a card shows the first two. A new version keeps the kind of each fact.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "kind"],
        properties: { key: { type: "string", pattern: A_FACT_KEY }, label: text(40), kind: { enum: Object.keys(THE_KINDS_OF_A_FACT) } },
      },
    },
  },
};

/** The contract of each kind, by version. */
export const CONTRACTS = { bid: { 1: BID_V1 }, prospect: { 1: PROSPECT_V1 } };

/** The contract a manifest names, or null. */
export function theContractOf(kind, version) {
  return CONTRACTS[kind]?.[version] ?? null;
}

/** The record's identity: one record per source and key (MOD-01.1 item 7). A bid is its source and key; a prospect is
 *  its company's domain, at the module that found it. */
export function theIdentityOf(kind, record, moduleName) {
  if (!record || typeof record !== "object") return null;
  if (kind === "bid") return typeof record.source === "string" && typeof record.key === "string" ? { source: record.source, key: record.key } : null;
  return typeof record.domain === "string" ? { source: moduleName, key: record.domain } : null;
}
