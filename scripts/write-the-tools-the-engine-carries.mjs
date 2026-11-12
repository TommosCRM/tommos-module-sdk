// In the Tommos monorepo: writes this version of the tools as one JSON file the engine carries into each sandbox
// (apps/crm/lib/modules/the-tools/<version>.json). Each version written stays: a module that names an older version
// runs with it, and Tommos says it is old (MOD-01.2 item 5). Run: node scripts/write-the-tools-the-engine-carries.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(here, "package.json"), "utf8")).version;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === "__pycache__" ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = {};
for (const f of [join(here, "package.json"), ...walk(join(here, "src")), ...walk(join(here, "contracts")), ...walk(join(here, "python", "tommos_module"))]) {
  if (f.endsWith(".d.ts")) continue;
  files[relative(here, f)] = readFileSync(f, "utf8");
}
const out = join(here, "..", "..", "apps", "crm", "lib", "modules", "the-tools");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${version}.json`), `${JSON.stringify({ version, files }, null, 1)}\n`);
const versions = readdirSync(out).filter((f) => /^\d+\.\d+\.\d+\.json$/.test(f)).map((f) => f.slice(0, -5));
versions.sort((a, b) => a.split(".").map(Number).reduce((r, x, i) => r || x - b.split(".").map(Number)[i], 0));
writeFileSync(
  join(out, "index.ts"),
  `// Written by packages/module-sdk/scripts/write-the-tools-the-engine-carries.mjs: each version of the tools the engine\n// carries into a sandbox, oldest first. A check fails when the newest is not the package as it is.\n${versions.map((v, i) => `import v${i} from "./${v}.json";`).join("\n")}\n\nexport const THE_TOOLS_THE_ENGINE_CARRIES: Record<string, { version: string; files: Record<string, string> }> = {\n${versions.map((v, i) => `  "${v}": v${i},`).join("\n")}\n};\n`,
);
console.log(versions.join(", "));
