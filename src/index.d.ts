// The types of @tommos/module-sdk.

export declare const VERSION: string;

/** What Tommos gives «find»: the cursor of the last run that worked (null on the first run) and the time of this run. */
export interface Context<C = unknown> {
  cursor: C | null;
  now: string;
}
/** What «find» gives back: the records of its kind and the new cursor. */
export interface Found<C = unknown> {
  records: unknown[];
  cursor: C | null;
}

export interface Bid {
  source: string;
  key: string;
  /** The rule of the module that took this record, as a fact. */
  matched: string;
  title: string;
  /** `email`: the buyer's email as the notice states it (OCDS: the buyer party's contactPoint.email). It may name a person;
   *  Tommos uses only its domain, and makes no contact of it. */
  buyer: { name: string; key?: string; type?: string; email?: string };
  contact_email?: string;
  due_date?: string;
  posted_date?: string;
  source_url: string;
  summary?: string;
  description?: string;
  documents?: { name: string; url: string }[];
  value_estimate?: { low?: number; high?: number; currency: string };
  country?: string;
  naics?: string;
  cpv?: string[];
  opp_type?: string;
  place?: { city?: string; region?: string };
}
export interface Evidence {
  what: string;
  url: string;
  date?: string;
  quote?: string;
}
export interface Prospect {
  domain: string;
  name: string;
  /** The rule of the module that took this company, as a fact. */
  matched: string;
  evidence: Evidence[];
  segment?: string;
  score?: number;
  /** The value of each fact the manifest names that the record knows, by the fact's key. */
  facts?: Record<string, AFactsValue>;
  country?: string;
  people?: { name: string; title?: string; email?: string; url?: string }[];
}

/** The kinds of a fact (MOD-01.1): text, money, count, date. */
export type AKindOfAFact = "text" | "money" | "count" | "date";
/** A fact a module names in its manifest: its key, the label a screen shows, its kind. */
export interface AFactOfAModule {
  key: string;
  label: string;
  kind: AKindOfAFact;
}
/** A fact's value by its kind: a text; { amount, currency } for money; a whole number for count; YYYY-MM-DD for date. */
export type AFactsValue = string | number | { amount: number; currency: string };

export interface Manifest {
  manifest_version: 1;
  name: string;
  title: string;
  about?: string;
  kind: "bid" | "prospect";
  contract: { version: 1 };
  entry: string;
  sdk: { version: string };
  schedule: { every_minutes: number };
  secrets: { name: string; about?: string }[];
  hosts: string[];
  time_limit_seconds: number;
  max_model_calls_per_run?: number;
  record_sources: string[];
  /** At most six, in the order a screen shows them. */
  facts?: AFactOfAModule[];
}

export declare class ContractError extends Error {
  reasons: string[];
  record: unknown;
  constructor(reasons: string[], record: unknown);
}
export declare class FetchError extends Error {
  status: number | null;
}
export interface AnAnswer {
  url: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  text(): string;
  json(): unknown;
}
export declare function fetch(url: string, o?: { tries?: number; waitMs?: number; timeoutMs?: number; headers?: Record<string, string>; method?: string; body?: string }): Promise<AnAnswer>;
/** The module's own lines of the log, of three kinds only (MOD-02.2 item 4). */
export declare const log: {
  /** What it read and how much: «Contracts Finder, the tenders of 10 November, page 1», 20. */
  read(where: string, count: number | null): void;
  /** A record it dropped, and why: «ocds-b5fd17-…», «its due date has passed». */
  skipped(key: string, reason: string): void;
  /** Something a person should know: «page 3 answered 503; the run took pages 1 and 2». */
  warning(text: string): void;
};
export type ALineOfTheModule = { kind: "read"; where: string; count: number | null } | { kind: "skipped"; key: string; reason: string } | { kind: "warning"; text: string };
export declare const THE_MOST_LINES_OF_A_RUN: number;
export declare const A_LINE_IS_AT_MOST: number;
/** The values of the module's secrets, and the query of each address, taken out of a text. */
export declare function withoutSecrets(text: unknown): string;
export declare function aDomain(v: unknown): string | null;
export declare function aDate(v: unknown): string | null;
export declare function aKey(...parts: unknown[]): string;
export declare function aBid(fields: Record<string, unknown>): Bid;
export declare function aProspect(fields: Record<string, unknown>): Prospect;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare function theCursor<C = any>(context: { cursor?: C | null } | null | undefined, start?: C): C;

type Schema = Record<string, unknown>;
export declare const BID_V1: Schema;
export declare const PROSPECT_V1: Schema;
export declare const MANIFEST_V1: Schema;
export declare const CONTRACTS: Record<string, Record<number, Schema>>;
export declare const THE_KINDS_OF_A_FACT: Record<AKindOfAFact, Schema>;
export declare const THE_MOST_FACTS_OF_A_MODULE: number;
/** The reasons a new version changes the kind of a fact the version that runs names; empty when each keeps its kind. */
export declare function theFactsKeepTheirKinds(before: Pick<Manifest, "facts"> | null | undefined, after: Pick<Manifest, "facts">): string[];
/** The reasons the facts of a record fail the facts its manifest names: a fact not named, a value of the wrong kind. */
export declare function theFactsOfARecordFail(manifest: Pick<Manifest, "facts">, record: unknown): string[];
export declare function theContractOf(kind: string, version: number): Schema | null;
export declare function theIdentityOf(kind: string, record: unknown, moduleName: string): { source: string; key: string } | null;
export declare function theReasonsItFails(schema: Schema, value: unknown, path?: string): string[];
export declare function readTheManifest(raw: unknown): { ok: true; manifest: Manifest } | { ok: false; reasons: string[] };

export declare const THE_MOST_RECORDS_OF_A_RUN: number;
export declare function theOutputOfARun(raw: unknown, secrets?: string[]): { ok: true; records: unknown[]; cursor: unknown; log: ALineOfTheModule[]; linesRefused: number; linesCut: number; asked: string[] } | { ok: false; why: string; log?: ALineOfTheModule[] };
export declare function theLinesOfAModule(raw: unknown, secrets?: string[]): { lines: ALineOfTheModule[]; refused: number; cut: number };
export interface AJudgedRecord {
  record: unknown;
  identity: { source: string; key: string };
}
export declare const THE_SOURCES_OF_TOMMOS: string[];
export declare const THE_DOMAINS_OF_TOMMOS: string[];
/** True when a host is, or as a wildcard covers, a host of Tommos itself. */
export declare function aHostOfTommos(host: string): boolean;
export declare function withoutTheSecrets(text: unknown, secrets?: string[], max?: number): string;
export declare function theRecordsJudged(manifest: Manifest, records: unknown[], o?: { secrets?: string[] }): { good: AJudgedRecord[]; refused: { record: unknown; identity: { source: string; key: string } | null; reasons: string[] }[]; sameInTheRun: number };

export type PackageFiles = Record<string, string>;
export interface ACheck {
  ok: boolean;
  manifest: Manifest | null;
  reasons: string[];
  /** On a laptop, the checks g, h and i warn here; in Tommos they refuse. */
  warnings: string[];
  /** Each failed check, by its letter of MOD-02.1 item 1, its short name and its words. */
  failed: { check: keyof typeof THE_CHECKS; name: string; said: string }[];
  examples: { name: string; ok: boolean; records: number; reasons: string[] }[];
}
export type ARunner = (i: { files: PackageFiles; manifest: Manifest; entry: string; example: string; context: unknown; secrets: Record<string, string> }) => Promise<{ ok: true; output: string; ms?: number } | { ok: false; error: string; ms?: number }>;
export interface CheckOptions {
  entry?: string;
  strict?: boolean;
  versions?: string[];
  oldest?: string;
  toolHashes?: Set<string>;
  /** The manifest of the version that runs, for a new version: each fact keeps its kind. */
  before?: Pick<Manifest, "facts"> | null;
}
export declare function checkAPackage(files: PackageFiles, run: ARunner, o?: CheckOptions): Promise<ACheck>;
export declare const THE_CHECKS: { a: string; b: string; c: string; d: string; e: string; f: string; g: string; h: string; i: string; j: string; k: string; examples: string };
export declare const THE_HOSTS_OF_MODEL_PROVIDERS: string[];
export declare const A_KEY_OF_A_MODEL: RegExp;
export declare function theModelIsAskedOnlyThroughTommos(manifest: Manifest): { check: "j" | "k"; said: string }[];
/** Ask a model through Tommos (MOD-01.3): the class of the task, never a model or a key. Answers the text, and the
 *  JSON when `json` is true. A call over the run's or the day's limit is refused with words (AskRefused). */
export declare function ask(o: { class: "fast" | "smart"; system?: string; prompt: string; maxTokens?: number; json?: boolean }): Promise<{ text: string; json?: unknown }>;
export declare class AskRefused extends Error {}
export declare function theFunctionFindIsThere(files: PackageFiles, entry: string): string[];
export declare function theHashOfAFile(text: string): string;
export declare function theSecretsOfTheCheck(manifest: Manifest): Record<string, string>;
export declare function theCheckInWords(check: ACheck): string;
export declare function theExamplesOf(files: PackageFiles): string[];
export declare function thePackageAsFiles(entries: [string, string][]): { ok: true; files: PackageFiles } | { ok: false; why: string };
export declare function theToolsAreTakenAsAPackage(files: PackageFiles, manifest: Manifest, o?: CheckOptions): string[];
