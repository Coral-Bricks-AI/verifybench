import fs from "fs";
import path from "path";
import { packageRoot } from "./report.ts";

// The eval set is versioned as a whole (manifest.version) and per eval
// (entry.version). A result is only comparable to another result on the same
// eval id and version; the set version says which evals a run covered.
export type EvalKind = "protocol" | "behaviour";
export type Route = "chat" | "responses" | "messages" | "raw";
export type Mode = "stream" | "nonstream";
// synbad: inherited from Synbad (github.com/synthetic-lab/synbad), MIT.
// verifybench: written for verifybench.
export type Origin = "synbad" | "verifybench";

export type ManifestEntry = {
  // Stable id: the eval's path under evals/ without the extension.
  id: string,
  // Bumped whenever the request or the pass criterion changes.
  version: number,
  route: Route,
  capability: string,
  origin: Origin,
  // protocol: the API contract, checked once per run.
  // behaviour: what the model does with a correct request; sampled with --count.
  kind: EvalKind,
  // Which forms of the route the eval applies to. Absent means both.
  modes?: Mode[],
  criterion: string,
};

export type Manifest = {
  name: string,
  version: string,
  released: string,
  evals: ManifestEntry[],
};

export function manifestPath() {
  return path.join(packageRoot(), "evals", "manifest.json");
}

let cached: Manifest | undefined;

export function loadManifest(): Manifest {
  if(!cached) cached = JSON.parse(fs.readFileSync(manifestPath(), "utf8")) as Manifest;
  return cached;
}

export function manifestEntry(id: string): ManifestEntry | undefined {
  return loadManifest().evals.find(entry => entry.id === id);
}

export function appliesTo(entry: ManifestEntry, stream: boolean) {
  return !entry.modes || entry.modes.includes(stream ? "stream" : "nonstream");
}
