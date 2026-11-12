#!/usr/bin/env node
// tommos-module check <folder> [--entry find.py]: the check Tommos runs when a person adds the module (MOD-02.1 item 1).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { checkAPackage, theCheckInWords, thePackageAsFiles } from "../src/check.js";
import { aLocalRunner } from "../src/local-runner.js";
import { VERSION } from "../src/tools.js";

const [, , what, folder = ".", ...rest] = process.argv;
if (what !== "check") {
  console.log("Usage: tommos-module check <folder> [--entry find.ts|find.py]");
  process.exit(what ? 2 : 0);
}
const entry = rest[rest.indexOf("--entry") + 1] && rest.includes("--entry") ? rest[rest.indexOf("--entry") + 1] : undefined;
const root = resolve(folder);
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  if (n.startsWith(".") || n === "node_modules" || n === "__pycache__") return [];
  return statSync(p).isDirectory() ? walk(p) : [[relative(root, p), readFileSync(p, "utf8")]];
});
const pkg = thePackageAsFiles(walk(root));
if (!pkg.ok) {
  console.error(pkg.why);
  process.exit(1);
}
const check = await checkAPackage(pkg.files, aLocalRunner(), { entry });
for (const r of check.reasons) console.log(`  ✗ ${r}`);
for (const w of check.warnings) console.log(`  ! ${w} (Tommos refuses this when you add the module)`);
for (const e of check.examples) {
  console.log(`  ${e.ok ? "✓" : "✗"} example «${e.name}»: ${e.records} record${e.records === 1 ? "" : "s"}`);
  for (const r of e.reasons) console.log(`      ${r}`);
}
if (check.manifest && check.manifest.sdk.version !== VERSION) console.log(`  · the manifest names the tools ${check.manifest.sdk.version}; this check runs with the tools ${VERSION}`);
console.log(theCheckInWords(check));
process.exit(check.ok ? 0 : 1);
