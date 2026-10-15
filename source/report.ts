import fs from "fs";
import os from "os";
import path from "path";
import type { EvalKind, Origin, Route } from "./manifest.ts";
import type { Status } from "./status.ts";
import type { CapabilityRollup, Verdict, VerdictCounts } from "./verdict.ts";

export const REPORT_FORMAT = 3;

export type EvalResult = {
  id: string,
  version: number,
  kind: EvalKind,
  route: Route,
  capability: string,
  origin: Origin,
  status: Status,
  // full / passable / not_acceptable for a pass or fail; null otherwise.
  verdict: Verdict | null,
  // Samples taken: 1 for protocol evals, --count for behaviour evals (fewer
  // when one ended the eval as unsupported).
  samples: number,
  // How the samples ended.
  sampleStatuses: Partial<Record<Status, number>>,
  // pass / (pass + fail) over the samples; null when none was scored.
  passRate: number | null,
  ms: number,
  // Why it failed, or why it wasn't scored.
  detail?: string,
  // Remarks on a pass, e.g. "refused the schema" where refusing is correct.
  notes?: string,
};

export type Report = {
  format: number,
  tool: { name: string, version: string },
  manifest: { name: string, version: string },
  provider: string,
  model: string,
  baseUrl: string,
  stream: boolean,
  reasoningEffort: string | null,
  count: number,
  // Output cap applied to requests that set none.
  defaultMaxTokens: number,
  // Pass rate a behaviour eval needs for "passable".
  passableRate: number,
  startedAt: string,
  finishedAt: string,
  totals: Record<Status, number>,
  // Verdict counts over the graded evals, the worst verdict of the run, and
  // the same rolled up per capability.
  verdicts: VerdictCounts,
  verdict: Verdict | null,
  capabilities: Record<string, CapabilityRollup>,
  results: EvalResult[],
};

// The folder that holds package.json: the repo, or the installed package.
export function packageRoot(): string {
  let dir = import.meta.dirname;
  while(!fs.existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if(parent === dir) throw new Error("package.json not found above " + import.meta.dirname);
    dir = parent;
  }
  return dir;
}

export function packageVersion(): string {
  return JSON.parse(fs.readFileSync(path.join(packageRoot(), "package.json"), "utf8")).version;
}

// Report text ends up in public results: keep local paths out of it.
export function scrub(text: string): string {
  const home = os.homedir();
  const root = packageRoot();
  let out = text;
  if(root.length > 1) out = out.split(root).join("<verifybench>");
  if(home.length > 1) out = out.split(home).join("~");
  return out;
}
