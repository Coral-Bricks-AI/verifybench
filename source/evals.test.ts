import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { getEvals } from "./evals.ts";
import { loadManifest } from "./manifest.ts";
import { classifyError, classifyHttp, InfraError, Skipped, Unsupported } from "./status.ts";
import { rollup, verdictFor } from "./verdict.ts";

describe("get-evals", () => {
  it("works", async () => {
    const evals = await getEvals();
    evals.map((evaluation) => {
      expect(evaluation.name).toBeTypeOf("string");
      if("run" in evaluation) {
        expect(evaluation.run).toBeTypeOf("function");
        return;
      }
      expect(evaluation.json).toBeTruthy();
      expect(evaluation.test).toBeTypeOf("function");
    });
  });
});

describe("manifest", () => {
  const manifest = loadManifest();

  it("has one entry per eval file, and no others", async () => {
    const root = path.join(import.meta.dirname, "..", "evals");
    const files: string[] = [];
    for(const dir of fs.readdirSync(root)) {
      if(!fs.statSync(path.join(root, dir)).isDirectory()) continue;
      for(const file of fs.readdirSync(path.join(root, dir))) {
        // .ts under source/, .js (and .d.ts) when the built copy in dist/ runs.
        if(/\.(ts|js)$/.test(file) && !file.endsWith(".d.ts")) files.push(`${dir}/${file.replace(/\.(ts|js)$/, "")}`);
      }
    }
    expect(manifest.evals.map(e => e.id).sort()).toEqual(files.sort());
  });

  it("describes every eval completely", () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    const ids = new Set<string>();
    for(const entry of manifest.evals) {
      expect(ids.has(entry.id), entry.id).toBe(false);
      ids.add(entry.id);
      expect(Number.isInteger(entry.version) && entry.version >= 1, entry.id).toBe(true);
      expect(["chat", "responses", "messages", "raw"], entry.id).toContain(entry.route);
      expect(["protocol", "behaviour"], entry.id).toContain(entry.kind);
      expect(entry.capability.length, entry.id).toBeGreaterThan(0);
      expect(["synbad", "verifybench"], entry.id).toContain(entry.origin);
      expect(entry.criterion.length, entry.id).toBeGreaterThan(20);
      for(const mode of entry.modes ?? []) expect(["stream", "nonstream"], entry.id).toContain(mode);
    }
  });
});

describe("synbad attribution", () => {
  it("credits Synbad at the top of every inherited eval", () => {
    const root = path.join(import.meta.dirname, "..", "evals");
    for(const entry of loadManifest().evals.filter(e => e.origin === "synbad")) {
      const ts = path.join(root, entry.id + ".ts");
      if(!fs.existsSync(ts)) continue; // the built copy in dist/ has no comments to check
      expect(fs.readFileSync(ts, "utf8").startsWith("// Originally from Synbad"), entry.id).toBe(true);
    }
  });
});

describe("verdicts", () => {
  it("grades protocol evals full or not acceptable", () => {
    expect(verdictFor("protocol", "pass", 1)).toBe("full");
    expect(verdictFor("protocol", "fail", 0)).toBe("not_acceptable");
  });
  it("grades behaviour evals by pass rate", () => {
    expect(verdictFor("behaviour", "pass", 1)).toBe("full");
    expect(verdictFor("behaviour", "fail", 2 / 3)).toBe("passable");
    expect(verdictFor("behaviour", "fail", 0.5)).toBe("passable");
    expect(verdictFor("behaviour", "fail", 1 / 3)).toBe("not_acceptable");
  });
  it("leaves ungraded statuses out", () => {
    for(const status of ["unsupported", "infra_error", "skipped"] as const) {
      expect(verdictFor("protocol", status, null)).toBeNull();
    }
  });
  it("rolls up to the worst verdict", () => {
    const r = rollup([
      { capability: "a", status: "pass", verdict: "full" },
      { capability: "a", status: "fail", verdict: "passable" },
      { capability: "b", status: "unsupported", verdict: null },
    ]);
    expect(r.capabilities["a"].verdict).toBe("passable");
    expect(r.capabilities["b"].verdict).toBeNull();
    expect(r.capabilities["b"].ungraded.unsupported).toBe(1);
    expect(r.verdict).toBe("passable");
  });
});

describe("status model", () => {
  it("classifies HTTP errors", () => {
    expect(classifyHttp(429, {})).toBe("infra_error");
    expect(classifyHttp(503, {})).toBe("infra_error");
    expect(classifyHttp(404, {})).toBe("unsupported");
    expect(classifyHttp(501, {})).toBe("unsupported");
    expect(classifyHttp(400, { error: { message: "background is not supported" } })).toBe("unsupported");
    expect(classifyHttp(400, { error: { code: "unsupported_parameter", message: "x" } })).toBe("unsupported");
    expect(classifyHttp(400, { error: { message: "messages: field required" } })).toBeUndefined();
  });

  it("classifies thrown errors", () => {
    expect(classifyError(new Unsupported("x")).status).toBe("unsupported");
    expect(classifyError(new InfraError("x")).status).toBe("infra_error");
    expect(classifyError(new Skipped("x")).status).toBe("skipped");
    expect(classifyError(new Error("x")).status).toBe("fail");
  });
});
