import type { EvalKind } from "./manifest.ts";
import type { Status } from "./status.ts";

// The grade a scored eval gets, on top of its status. Only pass/fail results
// are graded; unsupported, infra_error and skipped stay outside the verdicts.
//
//   full            protocol: passed. behaviour: every scored sample passed.
//   passable        behaviour only: at least PASSABLE_RATE of the scored
//                   samples passed. Never given to a protocol eval, whose
//                   contract either holds or doesn't.
//   not_acceptable  protocol: failed. behaviour: under PASSABLE_RATE.
export const VERDICTS = ["full", "passable", "not_acceptable"] as const;
export type Verdict = typeof VERDICTS[number];

export const PASSABLE_RATE = 0.5;

// Worst first.
const RANK: Record<Verdict, number> = { not_acceptable: 0, passable: 1, full: 2 };

export function verdictFor(kind: EvalKind, status: Status, passRate: number | null): Verdict | null {
  if(status !== "pass" && status !== "fail") return null;
  if(kind === "protocol") return status === "pass" ? "full" : "not_acceptable";
  const rate = passRate ?? (status === "pass" ? 1 : 0);
  if(rate >= 1) return "full";
  if(rate >= PASSABLE_RATE) return "passable";
  return "not_acceptable";
}

export function worst(verdicts: Array<Verdict | null | undefined>): Verdict | null {
  let out: Verdict | null = null;
  for(const v of verdicts) {
    if(!v) continue;
    if(out === null || RANK[v] < RANK[out]) out = v;
  }
  return out;
}

export type VerdictCounts = Record<Verdict, number>;

export function emptyVerdictCounts(): VerdictCounts {
  return { full: 0, passable: 0, not_acceptable: 0 };
}

export type CapabilityRollup = {
  // Worst verdict among the capability's graded evals; null when none was graded.
  verdict: Verdict | null,
  evals: number,
  verdicts: VerdictCounts,
  // Evals of this capability that weren't graded, by status.
  ungraded: Partial<Record<"unsupported" | "infra_error" | "skipped", number>>,
};

export function rollup(results: Array<{ capability: string, status: Status, verdict: Verdict | null }>) {
  const capabilities: Record<string, CapabilityRollup> = {};
  const verdicts = emptyVerdictCounts();
  for(const r of results) {
    const cap = capabilities[r.capability] ??= { verdict: null, evals: 0, verdicts: emptyVerdictCounts(), ungraded: {} };
    cap.evals++;
    if(r.verdict) {
      cap.verdicts[r.verdict]++;
      verdicts[r.verdict]++;
      cap.verdict = worst([cap.verdict, r.verdict]);
    } else if(r.status === "unsupported" || r.status === "infra_error" || r.status === "skipped") {
      cap.ungraded[r.status] = (cap.ungraded[r.status] ?? 0) + 1;
    }
  }
  const sorted = Object.fromEntries(Object.entries(capabilities).sort(([a], [b]) => a.localeCompare(b)));
  return { verdict: worst(Object.values(capabilities).map(c => c.verdict)), verdicts, capabilities: sorted };
}
