// The runner of `tommos-module check` on a laptop or in CI: the package is copied to a folder of its own, the tools of
// this very package stand beside it as `@tommos/module-sdk` (and as `tommos_module` for Python), and the example's
// answers come from its responses.json, so no call leaves the machine.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THE_TOOLS = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Run a command; answers its exit code and what it wrote to stderr, killed past `ms`. */
function aCommand(cmd, args, o) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { cwd: o.cwd, env: o.env, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    const t = setTimeout(() => p.kill("SIGKILL"), o.ms);
    p.on("error", (e) => {
      clearTimeout(t);
      res({ code: -1, err: e.message });
    });
    p.on("close", (code) => {
      clearTimeout(t);
      res({ code, err });
    });
  });
}

/** The command that runs an entry, as Tommos runs it in the sandbox too. */
export function theCommandOf(entry, at) {
  if (entry.endsWith(".py")) return { cmd: "python3", args: ["-m", "tommos_module.run"], pythonPath: at.python };
  return { cmd: process.execPath, args: ["--no-warnings", ...(entry.endsWith(".ts") ? ["--experimental-strip-types"] : []), at.runJs], pythonPath: null };
}

/** A runner for `checkAPackage` that runs each example here. */
export function aLocalRunner(o = {}) {
  return async ({ files, manifest, entry, example, context, secrets = {} }) => {
    const began = Date.now();
    const dir = mkdtempSync(join(tmpdir(), "tommos-module-"));
    try {
      const mod = join(dir, "module");
      for (const [p, text] of Object.entries(files)) {
        mkdirSync(dirname(join(mod, p)), { recursive: true });
        writeFileSync(join(mod, p), text);
      }
      mkdirSync(join(dir, "node_modules", "@tommos"), { recursive: true });
      symlinkSync(THE_TOOLS, join(dir, "node_modules", "@tommos", "module-sdk"), "dir");
      writeFileSync(join(dir, "context.json"), JSON.stringify(context));
      const c = theCommandOf(entry, { python: join(THE_TOOLS, "python"), runJs: join(THE_TOOLS, "src", "run.js") });
      const responses = join(mod, "examples", example, "responses.json");
      const env = {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? dir,
        TOMMOS_ENTRY: join(mod, entry),
        TOMMOS_CONTEXT: join(dir, "context.json"),
        TOMMOS_OUT: join(dir, "out.json"),
        TOMMOS_HOSTS: manifest.hosts.join(","),
        TOMMOS_RESPONSES: files[`examples/${example}/responses.json`] ? responses : "",
        TOMMOS_MODULE: mod,
        ...secrets,
        TOMMOS_SECRET_NAMES: Object.keys(secrets).join(","),
        ...(c.pythonPath ? { PYTHONPATH: c.pythonPath } : {}),
      };
      if (!env.TOMMOS_RESPONSES) return { ok: false, error: `the example «${example}» holds no responses.json: an example answers every call from it`, ms: 0 };
      // A laptop is slower than the sandbox, or faster: it gives a run three times its limit, and the check warns past it.
      const r = await aCommand(c.cmd, c.args, { cwd: mod, env, ms: (o.timeLimitSeconds ?? manifest.time_limit_seconds) * 3000 });
      const ms = Date.now() - began;
      let output = null;
      try {
        output = readFileSync(env.TOMMOS_OUT, "utf8");
      } catch {
        /* no output: said below */
      }
      if (output === null) return { ok: false, error: r.code === null ? `it did not end within ${manifest.time_limit_seconds * 3} s` : `it wrote nothing (exit ${r.code}): ${r.err.trim().slice(-600)}`, ms };
      return { ok: true, output, ms };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
