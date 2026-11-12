"""The runner: `python3 -m tommos_module.run`. It reads the context, calls the module's «find», and writes
{ records, cursor, log } or { error, log } to the file TOMMOS_OUT names. What «find» prints is never read as records."""
import importlib.util
import json
import os
import sys

from .tools import hosts_this_run_asked, lines_of_the_log, without_secrets


def main():
    out = os.environ["TOMMOS_OUT"]
    try:
        with open(os.environ["TOMMOS_CONTEXT"], encoding="utf-8") as f:
            context = json.load(f)
        entry = os.environ["TOMMOS_ENTRY"]
        sys.path.insert(0, os.path.dirname(entry))
        spec = importlib.util.spec_from_file_location("find", entry)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        if not callable(getattr(mod, "find", None)):
            raise RuntimeError("the entry has no function «find»")
        got = mod.find(context) or {}
        with open(out, "w", encoding="utf-8") as f:
            kept = lines_of_the_log()
            json.dump({"records": got.get("records"), "cursor": got.get("cursor"), "log": kept["lines"], "dropped": kept["dropped"], "asked": hosts_this_run_asked()}, f, ensure_ascii=False)
    except Exception as e:  # the module stopped: said in the run's log
        with open(out, "w", encoding="utf-8") as f:
            kept = lines_of_the_log()
            json.dump({"error": without_secrets(f"{type(e).__name__}: {e}")[:2000], "log": kept["lines"], "dropped": kept["dropped"], "asked": hosts_this_run_asked()}, f, ensure_ascii=False)
        sys.exit(1)


if __name__ == "__main__":
    main()
