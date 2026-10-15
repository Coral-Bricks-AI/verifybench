import fs from "fs";
import { appliesTo, EvalKind, loadManifest } from "./manifest.ts";
import { EvalResult, Report } from "./report.ts";
import { emptyTotals, Status } from "./status.ts";
import { CapabilityRollup, rollup, Verdict, verdictFor, VERDICTS } from "./verdict.ts";

// Builds the provider x eval matrix from report files: one column per report,
// grouped as (provider, model) with the non-streaming column first. Graded
// results show their verdict; the rest show their status.

const UNGRADED = ["unsupported", "infra_error", "skipped"] as const;
type Ungraded = typeof UNGRADED[number];

const SYMBOL: Record<Verdict | Ungraded, string> = {
  full: ".", passable: "~", not_acceptable: "X", unsupported: "u", infra_error: "!", skipped: "s",
};
const WORD: Record<Verdict | Ungraded, string> = {
  full: "full", passable: "passable", not_acceptable: "**not acceptable**",
  unsupported: "unsupported", infra_error: "infra_error", skipped: "skipped",
};

type Column = {
  key: string,
  provider: string,
  model: string,
  stream: boolean,
  manifestVersion: string,
  reasoningEffort: string | null,
  file: string,
  results: Map<string, EvalResult>,
  totals: Record<Status, number>,
  verdicts: Record<Verdict, number>,
  verdict: Verdict | null,
  capabilities: Record<string, CapabilityRollup>,
};

function kindOf(id: string, fallback?: EvalKind): EvalKind {
  return fallback ?? loadManifest().evals.find(e => e.id === id)?.kind ?? "protocol";
}

// Older reports are read with today's rules as far as their content allows.
// Format 1 (before the status model) said passed/failed/skipped: a 429 was an
// infra error and a missing route unsupported. Formats 1 and 2 carry no
// verdicts; they are computed here from status, kind and pass rate.
function normalise(raw: any): Report {
  let results: EvalResult[];
  if((raw.format ?? 1) < 2) {
    results = (raw.results ?? []).map((r: any) => {
      const detail: string = r.detail ?? "";
      let status: Status;
      if(r.status === "passed") status = "pass";
      else if(r.status === "failed") status = /\b429\b|rate.?limit/i.test(detail) ? "infra_error" : "fail";
      else status = /route not offered/.test(detail) ? "unsupported" : "skipped";
      const entry = loadManifest().evals.find(e => e.id === r.name);
      return {
        id: r.name, version: 0, kind: entry?.kind ?? "protocol", route: entry?.route ?? "raw",
        capability: entry?.capability ?? "unknown", origin: entry?.origin ?? "verifybench",
        status, verdict: null, samples: r.runs ?? 1, sampleStatuses: { [status]: 1 }, passRate: null, ms: r.ms ?? 0,
        ...(detail ? { detail } : {}),
      } as EvalResult;
    });
  } else {
    results = raw.results;
  }
  for(const r of results) {
    if(r.verdict === undefined || (raw.format ?? 1) < 3) r.verdict = verdictFor(kindOf(r.id, r.kind), r.status, r.passRate);
  }
  const totals = emptyTotals();
  for(const r of results) totals[r.status]++;
  const graded = rollup(results);
  let host = "unknown";
  try { host = new URL(raw.baseUrl).hostname; } catch {}
  return {
    format: raw.format ?? 1,
    tool: raw.tool ?? { name: "verifybench", version: "pre-manifest" },
    manifest: raw.manifest ?? { name: "verifybench", version: "pre-manifest" },
    provider: raw.provider ?? host, model: raw.model, baseUrl: raw.baseUrl, stream: !!raw.stream,
    reasoningEffort: raw.reasoningEffort ?? null, count: raw.count ?? 1,
    defaultMaxTokens: raw.defaultMaxTokens ?? 0, passableRate: raw.passableRate ?? 0.5,
    startedAt: raw.startedAt ?? "", finishedAt: raw.finishedAt ?? "",
    totals, verdicts: graded.verdicts, verdict: graded.verdict, capabilities: graded.capabilities, results,
  };
}

export function loadColumns(files: string[]): Column[] {
  const columns: Column[] = [];
  for(const file of files) {
    const report = normalise(JSON.parse(fs.readFileSync(file, "utf8")));
    const key = `${report.provider}|${report.model}|${report.stream ? "s" : "ns"}`;
    const existing = columns.findIndex(column => column.key === key);
    if(existing !== -1) {
      process.stderr.write(`note: ${file} replaces ${columns[existing].file} (same provider, model and mode)\n`);
      columns.splice(existing, 1);
    }
    columns.push({
      key, provider: report.provider, model: report.model, stream: report.stream,
      manifestVersion: report.manifest.version, reasoningEffort: report.reasoningEffort, file,
      results: new Map(report.results.map(r => [r.id, r])), totals: report.totals,
      verdicts: report.verdicts, verdict: report.verdict, capabilities: report.capabilities,
    });
  }
  // Group by provider and model in the order first seen, non-streaming first.
  const order = new Map<string, number>();
  for(const column of columns) {
    const group = `${column.provider}|${column.model}`;
    if(!order.has(group)) order.set(group, order.size);
  }
  return columns.sort((a, b) =>
    order.get(`${a.provider}|${a.model}`)! - order.get(`${b.provider}|${b.model}`)!
    || Number(a.stream) - Number(b.stream));
}

type Cell = { mark?: Verdict | Ungraded, rate?: string, na?: boolean };

function cell(column: Column, id: string): Cell {
  const result = column.results.get(id);
  const entry = loadManifest().evals.find(e => e.id === id);
  if(entry && !appliesTo(entry, column.stream) && (!result || result.status === "skipped")) return { na: true };
  if(!result) return {};
  const scored = (result.sampleStatuses.pass ?? 0) + (result.sampleStatuses.fail ?? 0);
  const rate = result.kind === "behaviour" && scored > 1 && result.status === "fail"
    ? `${result.sampleStatuses.pass ?? 0}/${scored}` : undefined;
  if(result.verdict) return { mark: result.verdict, rate };
  return { mark: result.status as Ungraded };
}

function capabilityMark(column: Column, name: string): Verdict | Ungraded | undefined {
  const cap = column.capabilities[name];
  if(!cap) return undefined;
  if(cap.verdict) return cap.verdict;
  return UNGRADED.find(status => (cap.ungraded[status] ?? 0) > 0);
}

export function buildMatrix(files: string[], { all = false }: { all?: boolean } = {}) {
  const columns = loadColumns(files);
  const ids = new Set<string>();
  const capabilities = new Set<string>();
  for(const column of columns) {
    for(const id of column.results.keys()) ids.add(id);
    for(const name of Object.keys(column.capabilities)) capabilities.add(name);
  }
  const rows = [...ids].sort().filter(id => all || columns.some(column => {
    const c = cell(column, id);
    return c.mark !== undefined && c.mark !== "full";
  }));
  const versions = [...new Set(columns.map(column => column.manifestVersion))];
  return { columns, rows, capabilities: [...capabilities].sort(), versions };
}

function columnTitle(column: Column) {
  return `${column.provider} ${column.model}${column.reasoningEffort ? ` (effort ${column.reasoningEffort})` : ""}`;
}

export function renderText(files: string[], opts: { all?: boolean } = {}) {
  const { columns, rows, capabilities, versions } = buildMatrix(files, opts);
  const lines: string[] = [];
  lines.push(`eval set ${versions.join(", ")}${versions.length > 1 ? "  (MIXED: results across set versions are not comparable)" : ""}`);
  const groups: string[] = [];
  for(const column of columns) {
    const title = columnTitle(column);
    if(!groups.includes(title)) groups.push(title);
  }
  groups.forEach((title, i) => lines.push(`  ${String.fromCharCode(65 + i)} = ${title}`));
  lines.push(`  ns = non-streaming, s = streaming`);
  lines.push(`  verdicts: . full support  ~ passable  X not acceptable   (n/m = samples passed, behaviour evals)`);
  lines.push(`  not graded: u unsupported  ! infra_error  s skipped  (blank) not applicable to the mode  - not run`);
  lines.push("");

  const labels = columns.map(column => `${String.fromCharCode(65 + groups.indexOf(columnTitle(column)))}.${column.stream ? "s" : "ns"}`);
  const evalCells = rows.map(id => columns.map(column => {
    const c = cell(column, id);
    if(c.na) return "";
    if(!c.mark) return "-";
    return SYMBOL[c.mark] + (c.rate ? ` ${c.rate}` : "");
  }));
  const capCells = capabilities.map(name => columns.map(column => {
    const mark = capabilityMark(column, name);
    return mark ? SYMBOL[mark] : "-";
  }));
  const totalNames = [...VERDICTS.map(v => v.replace("_", " ")), ...UNGRADED];
  const totalRows = [
    ...VERDICTS.map(v => columns.map(column => String(column.verdicts[v] ?? 0))),
    ...UNGRADED.map(s => columns.map(column => String(column.totals[s] ?? 0))),
  ];
  const runRow = columns.map(column => column.verdict ? SYMBOL[column.verdict] : "-");
  const firstWidth = Math.max(4, ...rows.map(id => id.length), ...capabilities.map(c => c.length + 2), ...totalNames.map(s => s.length + 2));
  const allRows = [...evalCells, ...capCells, ...totalRows, runRow];
  const widths = columns.map((_, i) => Math.max(labels[i].length, ...allRows.map(row => row[i].length)));
  const fmt = (first: string, row: string[]) =>
    first.padEnd(firstWidth) + "  " + row.map((value, i) => value.padStart(Math.ceil((widths[i] + value.length) / 2)).padEnd(widths[i])).join("  ");
  const rule = fmt("", columns.map((_, i) => "-".repeat(widths[i])));

  lines.push(fmt("eval", labels));
  rows.forEach((id, r) => lines.push(fmt(id, evalCells[r])));
  if(!opts.all) lines.push("(evals with full support in every column are left out; --all shows them)");
  lines.push("");
  lines.push(fmt("capability (worst verdict)", labels));
  capabilities.forEach((name, r) => lines.push(fmt("  " + name, capCells[r])));
  lines.push(rule);
  totalNames.forEach((name, r) => lines.push(fmt(name, totalRows[r])));
  lines.push(rule);
  lines.push(fmt("run (worst verdict)", runRow));
  return lines.join("\n");
}

export function renderMarkdown(files: string[], opts: { all?: boolean } = {}) {
  const { columns, rows, capabilities, versions } = buildMatrix(files, opts);
  const header = `| ${columns.map(column => `${columnTitle(column)} ${column.stream ? "stream" : "non-stream"}`).join(" | ")} |`;
  const sep = `|---|${columns.map(() => "---").join("|")}|`;
  const lines: string[] = [];
  lines.push(`Eval set ${versions.join(", ")}. Verdicts: full, passable, not acceptable; unsupported, infra_error and skipped are not graded.`);
  lines.push("");
  lines.push(`| eval ${header}`);
  lines.push(sep);
  for(const id of rows) {
    lines.push(`| ${id} | ${columns.map(column => {
      const c = cell(column, id);
      if(c.na) return "n/a";
      if(!c.mark) return "not run";
      return WORD[c.mark] + (c.rate ? ` ${c.rate}` : "");
    }).join(" | ")} |`);
  }
  lines.push("");
  lines.push(`| capability ${header}`);
  lines.push(sep);
  for(const name of capabilities) {
    lines.push(`| ${name} | ${columns.map(column => {
      const mark = capabilityMark(column, name);
      return mark ? WORD[mark] : "not run";
    }).join(" | ")} |`);
  }
  for(const v of VERDICTS) lines.push(`| *${v.replace("_", " ")}* | ${columns.map(column => String(column.verdicts[v] ?? 0)).join(" | ")} |`);
  for(const s of UNGRADED) lines.push(`| *${s}* | ${columns.map(column => String(column.totals[s] ?? 0)).join(" | ")} |`);
  lines.push(`| **run** | ${columns.map(column => column.verdict ? WORD[column.verdict] : "not graded").join(" | ")} |`);
  return lines.join("\n");
}

export function renderJson(files: string[], opts: { all?: boolean } = {}) {
  const { columns, rows, capabilities, versions } = buildMatrix(files, opts);
  return JSON.stringify({
    manifestVersions: versions,
    columns: columns.map(column => ({
      provider: column.provider, model: column.model, stream: column.stream,
      reasoningEffort: column.reasoningEffort, manifestVersion: column.manifestVersion,
      verdict: column.verdict, verdicts: column.verdicts, totals: column.totals,
    })),
    rows: rows.map(id => ({
      id,
      cells: columns.map(column => {
        const c = cell(column, id);
        return c.na ? "n/a" : c.mark ?? "not run";
      }),
    })),
    capabilities: capabilities.map(name => ({
      name,
      cells: columns.map(column => capabilityMark(column, name) ?? "not run"),
    })),
  }, null, 2);
}
