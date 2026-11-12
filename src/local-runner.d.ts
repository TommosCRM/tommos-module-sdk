import type { ARunner } from "./index";
export declare function aLocalRunner(o?: { timeLimitSeconds?: number }): ARunner;
export declare function theCommandOf(entry: string, at: { python: string; runJs: string }): { cmd: string; args: string[]; pythonPath: string | null };
