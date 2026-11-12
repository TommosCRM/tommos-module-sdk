// Writes the contracts of contracts.js as plain JSON: here, in the Python package, and, in the Tommos monorepo, under
// the CRM's public folder (https://app.tommos.ai/modules/contracts/). Run: node scripts/write-the-contracts.mjs
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BID_V1, MANIFEST_V1, PROSPECT_V1 } from "../src/contracts.js";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const places = [join(here, "contracts"), join(here, "python", "tommos_module", "contracts")];
const crm = join(here, "..", "..", "apps", "crm", "public", "modules", "contracts");
if (existsSync(join(here, "..", "..", "apps", "crm"))) places.push(crm);
for (const dir of places) {
  mkdirSync(dir, { recursive: true });
  for (const [name, schema] of [["bid.v1.json", BID_V1], ["prospect.v1.json", PROSPECT_V1], ["manifest.v1.json", MANIFEST_V1]]) writeFileSync(join(dir, name), `${JSON.stringify(schema, null, 2)}\n`);
}
console.log(places.join("\n"));
