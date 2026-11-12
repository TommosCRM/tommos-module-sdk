// The runner: Tommos starts it in the sandbox, and `tommos-module check` starts it on a laptop. It reads the context,
// calls the module's «find», and writes `{ records, cursor, log }`, or `{ error, log }`, to the file TOMMOS_OUT names.
// What «find» prints goes to the run's own output and is never read as records.

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { theHostsThisRunAsked, theLinesOfTheLog, withoutSecrets } from "./tools.js";

const out = process.env.TOMMOS_OUT;
const write = (o) => writeFileSync(out, JSON.stringify(o));
try {
  const context = JSON.parse(readFileSync(process.env.TOMMOS_CONTEXT, "utf8"));
  const mod = await import(pathToFileURL(process.env.TOMMOS_ENTRY).href);
  const find = mod.find ?? mod.default;
  if (typeof find !== "function") throw new Error("the entry exports no function «find»");
  const got = await find(context);
  const { lines, dropped } = theLinesOfTheLog();
  write({ records: got?.records, cursor: got?.cursor ?? null, log: lines, dropped, asked: theHostsThisRunAsked() });
} catch (e) {
  const { lines, dropped } = theLinesOfTheLog();
  write({ error: withoutSecrets(e instanceof Error ? e.message : String(e)).slice(0, 2000), log: lines, dropped, asked: theHostsThisRunAsked() });
  process.exitCode = 1;
}
