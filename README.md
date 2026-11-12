# The tools of Tommos for a module

`@tommos/module-sdk` (npm, this folder) and `tommos-module-sdk` (PyPI, `python/`): the tools a Tommos module takes
by version. A fetch that reaches only the manifest's hosts, waits between calls and tries again; the cursor; the
builders of a bid and a prospect that check the contract; the domain, the date and the key; the log of the run; and
`ask`, a model through Tommos. And the command `tommos-module check`, the same check Tommos runs when a person adds a
module.

Start from the reference module, TommosCRM/tommos-module-template: its `docs/` is the whole guide.

## Install by a tag

```sh
npm install github:TommosCRM/tommos-module-sdk#v0.1.0
pip install "tommos-module-sdk @ git+https://github.com/TommosCRM/tommos-module-sdk@v0.1.0#subdirectory=python"
```

## The check

```sh
npx tommos-module check <folder> [--entry find.ts|find.py]
```

It reads the manifest, runs each example of `examples/` twice on this computer with the answers the example holds,
and says each failed check in words. The checks of time, hosts and secrets only warn here; Tommos refuses on them.

## In this folder

| Path | What it is |
| --- | --- |
| `src/tools.js` | fetch, the cursor, the builders, the domain, the date, the key, the log, ask |
| `src/contracts.js` | The contracts Bid v1, Prospect v1 and the manifest's, as JSON Schemas |
| `src/schema.js` | The reader of the schemas, which says each reason a record fails |
| `src/check.js` | The check of a module, a to k |
| `src/run.js`, `python/tommos_module/run.py` | The runner Tommos starts in the sandbox |
| `bin/tommos-module.js` | The command `check` |
| `contracts/` | The contracts as plain JSON |
| `python/` | The same tools in Python |

In the Tommos monorepo, `node scripts/write-the-contracts.mjs` writes the contracts as JSON, and
`node scripts/write-the-tools-the-engine-carries.mjs` writes this version for the engine. Run both after a change.
