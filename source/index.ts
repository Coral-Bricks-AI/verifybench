#!/usr/bin/env node
import * as http from "http";
import * as https from "https";
import fs from "fs/promises";
import path from "path";
import { Command } from "@commander-js/extra-typings";
import OpenAI from "openai";
import { getEvals } from "./evals.ts";
import { createContext, DEFAULT_MAX_TOKENS } from "./context.ts";
import { ReasoningEffort } from "openai/resources";
import { appliesTo, loadManifest, manifestEntry } from "./manifest.ts";
import { EvalResult, packageVersion, Report, REPORT_FORMAT, scrub } from "./report.ts";
import { classifyError, emptyTotals, Status, STATUSES } from "./status.ts";
import { renderJson, renderMarkdown, renderText } from "./matrix.ts";
import { PASSABLE_RATE, rollup, Verdict, verdictFor, VERDICTS } from "./verdict.ts";

const cli = new Command()
.name("verifybench")
.description("Correctness checks for LLM inference providers: tool calls, reasoning, structured output and the Chat Completions, Responses and Messages routes");

const VERDICT_LABEL: Record<Verdict, string> = {
  full: "full support", passable: "passable", not_acceptable: "NOT ACCEPTABLE",
};

const LABEL: Record<Status, string> = {
  pass: "pass", fail: "FAIL", unsupported: "unsupported", infra_error: "infra_error", skipped: "skipped",
};

cli.command("eval")
.description("Runs the evals")
.requiredOption(
  "--env-var <env var name>", "The env var to use to authenticate with the inference provider"
)
.requiredOption(
  "--base-url <base url>", "The base URL for the inference provider"
)
.option(
  "--provider <name>", "Provider name recorded in the report (default: the base URL's host name)"
)
.option(
  "--skip-reasoning", "Skip reasoning evals (set this for non-reasoning models)"
)
.option(
  "--skip <dirs>", "Comma-separated eval directories to leave out, e.g. responses,messages"
)
.option(
  "--reasoning-effort <level>", "Set the reasoning effort to high, medium, or low"
)
.option(
  "--only <eval path within verifybench>", "Specific evals you want to run, e.g. evals/reasoning or evals/tools/claude-dash"
)
.option(
  "--count <samples>", "Samples per behaviour eval; the report gives each one's pass rate. Protocol evals always run once",
)
.option(
  "--stream", "Test streaming API calls",
)
.option(
  "--report <file>", "Write the per-eval results to this file as JSON",
)
.option(
  "--retry-429", "Wait out HTTP 429 (rate limit) responses for longer (12 tries, 10 s apart), for accounts with a low request rate",
)
.option(
  "--timeout <seconds>", "Per-request timeout; a request that takes longer ends the eval as infra_error", "600",
)
.option(
  "--verbose", "Print stack traces for failures",
)
.requiredOption("--model <model name>", "The model name to test")
.action(async ({ model, envVar, baseUrl, provider, only, count, skip, skipReasoning, reasoningEffort, stream, report, retry429, timeout, verbose }) => {
  if(!process.env[envVar]) {
    console.error(`No env var named ${envVar} exists for the current process`);
    process.exit(1);
  }
  const timeoutMs = Math.max(1, parseFloat(timeout)) * 1000;
  const client = new OpenAI({
    apiKey: process.env[envVar],
    baseURL: baseUrl,
    timeout: timeoutMs,
    // The SDK's backoff tops out at 8 s; a per-minute limit needs more tries to outlast.
    ...(retry429 ? { maxRetries: 12 } : {}),
  });
  const isStream = stream ?? false;
  const ctx = createContext({
    client,
    apiKey: process.env[envVar]!,
    baseUrl,
    model,
    stream: isStream,
    reasoningEffort: reasoningEffort as ReasoningEffort,
    retry429: retry429 ?? false,
    timeoutMs,
  });
  const manifest = loadManifest();
  const results: EvalResult[] = [];
  const evalPath = only
    ? path.join(import.meta.dirname, "..", only)
    : undefined;
  const samples = count == null ? 1 : Math.max(1, parseInt(count, 10));
  const skipDirs = (skip ?? "").split(",").map(dir => dir.trim()).filter(Boolean);
  if(skipReasoning) skipDirs.push("reasoning");
  const startedAt = new Date().toISOString();

  const evals = await getEvals(evalPath, skipDirs);
  for (const evaluation of evals) {
    const { name } = evaluation;
    const entry = manifestEntry(name);
    if(!entry) {
      console.error(`${name} has no entry in evals/manifest.json; add one before running it`);
      process.exit(1);
    }
    // An eval that only means something in one mode isn't run in the other.
    if(!appliesTo(entry, isStream)) continue;

    process.stdout.write(`Running ${name}...`);
    const startedEval = Date.now();
    const runs = entry.kind === "behaviour" ? samples : 1;
    const sampleStatuses: Partial<Record<Status, number>> = {};
    const notes = new Set<string>();
    let detail: string | undefined;
    let ended: Status | undefined;

    for(let i = 0; i < runs; i++) {
      if(runs > 1) process.stdout.write(` ${i + 1}/${runs}`);
      ctx.notes.length = 0;
      let status: Status = "pass";
      try {
        if("run" in evaluation) {
          await evaluation.run(ctx);
        } else {
          const response = await ctx.chat(evaluation.json);
          try {
            evaluation.test(response);
          } catch(e) {
            const shown = JSON.stringify(response.chatCompletionMessage, null, 2);
            console.error("\nResponse:");
            console.error(shown.length > 4000 ? `${shown.slice(0, 4000)}\n... (${shown.length} characters in all)` : shown);
            throw e;
          }
        }
        for(const note of ctx.notes) notes.add(note);
      } catch(e) {
        const classified = classifyError(e);
        status = classified.status;
        // The first failure explains the eval; later ones would repeat it.
        if(detail === undefined || (status === "fail" && sampleStatuses.fail === undefined)) {
          detail = scrub(classified.detail);
        }
        if(verbose && status === "fail" && e instanceof Error && e.stack) {
          console.error("\n" + scrub(e.stack));
        }
      }
      sampleStatuses[status] = (sampleStatuses[status] ?? 0) + 1;
      // The feature isn't there: more samples won't change that.
      if(status === "unsupported") { ended = status; break; }
    }

    const passes = sampleStatuses.pass ?? 0;
    const fails = sampleStatuses.fail ?? 0;
    const scored = passes + fails;
    let status: Status;
    if(ended) status = ended;
    else if(fails > 0) status = "fail";
    else if(passes > 0) status = "pass";
    else if(sampleStatuses.infra_error) status = "infra_error";
    else status = "skipped";
    if(status === "pass") detail = undefined;
    const noteText = [...notes].join("; ");
    const passRate = scored > 0 ? passes / scored : null;
    const verdict = verdictFor(entry.kind, status, passRate);

    results.push({
      id: entry.id,
      version: entry.version,
      kind: entry.kind,
      route: entry.route,
      capability: entry.capability,
      origin: entry.origin,
      status,
      verdict,
      samples: Object.values(sampleStatuses).reduce((a, b) => a + (b ?? 0), 0),
      sampleStatuses,
      passRate,
      ms: Date.now() - startedEval,
      ...(detail ? { detail } : {}),
      ...(noteText ? { notes: noteText } : {}),
    });
    const rate = runs > 1 && scored > 0 ? ` ${passes}/${scored}` : "";
    const why = status === "pass" ? (noteText ? ` (${noteText})` : "") : detail ? `: ${detail}` : "";
    // A protocol pass needs no verdict next to it; everything graded otherwise gets one.
    const verdictTag = verdict && (verdict !== "full" || runs > 1) ? ` [${VERDICT_LABEL[verdict]}]` : "";
    process.stdout.write(` ${LABEL[status]}${rate}${verdictTag}${why}\n`);
  }

  const totals = emptyTotals();
  for(const result of results) totals[result.status]++;
  const graded = rollup(results);

  if(report) {
    let host = "unknown";
    try { host = new URL(baseUrl).hostname; } catch {}
    const out: Report = {
      format: REPORT_FORMAT,
      tool: { name: "verifybench", version: packageVersion() },
      manifest: { name: manifest.name, version: manifest.version },
      provider: provider ?? host,
      model,
      baseUrl,
      stream: isStream,
      reasoningEffort: reasoningEffort ?? null,
      count: samples,
      defaultMaxTokens: DEFAULT_MAX_TOKENS,
      passableRate: PASSABLE_RATE,
      startedAt,
      finishedAt: new Date().toISOString(),
      totals,
      verdicts: graded.verdicts,
      verdict: graded.verdict,
      capabilities: graded.capabilities,
      results,
    };
    await fs.writeFile(report, JSON.stringify(out, null, 2) + "\n");
  }

  console.log("");
  console.log(`eval set ${manifest.version}, ${results.length} evals: ${STATUSES.map(status => `${status} ${totals[status]}`).join(", ")}`);
  console.log(`verdicts: ${VERDICTS.map(v => `${VERDICT_LABEL[v].toLowerCase()} ${graded.verdicts[v]}`).join(", ")}; run: ${graded.verdict ? VERDICT_LABEL[graded.verdict] : "not graded"}`);
  for(const verdict of ["not_acceptable", "passable"] as const) {
    const ids = results.filter(result => result.verdict === verdict).map(result => result.id);
    if(ids.length > 0) console.log(`\n${VERDICT_LABEL[verdict].toLowerCase()}:\n- ${ids.join("\n- ")}`);
  }
  for(const status of ["unsupported", "infra_error", "skipped"] as const) {
    const ids = results.filter(result => result.status === status).map(result => result.id);
    if(ids.length > 0) console.log(`\n${status}:\n- ${ids.join("\n- ")}`);
  }
  console.log("\ncapabilities:");
  for(const [name, cap] of Object.entries(graded.capabilities)) {
    const ungraded = Object.entries(cap.ungraded).map(([k, n]) => `${n} ${k}`).join(", ");
    console.log(`  ${name.padEnd(24)} ${cap.verdict ? VERDICT_LABEL[cap.verdict] : "not graded"}${ungraded ? ` (${ungraded})` : ""}`);
  }
  // 1: something failed. 2: nothing failed, but some evals couldn't be scored
  // for infrastructure reasons and should be rerun.
  process.exitCode = totals.fail > 0 ? 1 : totals.infra_error > 0 ? 2 : 0;
});

cli.command("matrix")
.description("Builds the provider x eval matrix from report files written by `eval --report`")
.argument("<reports...>", "Report JSON files")
.option("--format <format>", "text, md or json", "text")
.option("--all", "Show every eval, not only the ones that didn't pass somewhere")
.action(async (reports, { format, all }) => {
  const opts = { all: all ?? false };
  if(format === "md") console.log(renderMarkdown(reports, opts));
  else if(format === "json") console.log(renderJson(reports, opts));
  else console.log(renderText(reports, opts));
});

cli.command("manifest")
.description("Prints the eval-set manifest")
.action(() => {
  console.log(JSON.stringify(loadManifest(), null, 2));
});

cli.command("proxy")
.requiredOption("-p, --port <number>", "Port to listen on")
.requiredOption("-t, --target <url>", "Target URL to proxy to")
.option("--pretty", "Pretty-print the JSON")
.action(async (options) => {
  const port = parseInt(options.port, 10);
  const targetUrl = new URL(options.target);

  stderrLog(`🚀 Starting proxy on port ${port}`);
  stderrLog(`📯 Proxying to: ${targetUrl.origin}`);

  const server = http.createServer(async (req, res) => {
    try {
      const timestamp = new Date().toISOString();

      // Log request metadata
      stderrLog(`\n[${timestamp}] 📥 ${req.method} ${req.url}`);

      // Construct target URL - handle target path correctly
      const incomingPath = req.url || "";
      const targetBasePath = targetUrl.pathname.replace(/\/$/, ''); // Remove trailing slash
      const targetPath = targetBasePath + incomingPath;
      const target = `${targetUrl.origin}${targetPath}`;

      // Prepare request headers (remove problematic ones)
      const requestHeaders = { ...req.headers };
      delete requestHeaders["host"];
      delete requestHeaders["content-length"];
      delete requestHeaders["transfer-encoding"];

      stderrLog(`[${timestamp}] ➡️  Forwarding to: ${target}`);
      stderrLog(`[${timestamp}] 📦 Writing request data to stdout...`);

      // Choose the right module based on target protocol
      const httpModule = targetUrl.protocol === "https:" ? https : http;

      const buffer: string[] = [];

      // Create proxy request
      const proxyReq = httpModule.request(
        {
          hostname: targetUrl.hostname,
          port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
          path: targetPath,
          method: req.method,
          headers: requestHeaders,
        },
        (proxyRes) => {
          // Log response status and headers
          stderrLog(
            `[${timestamp}] 📤 Response to ${req.url}: ${proxyRes.statusCode} ${proxyRes.statusMessage}`
          );
          stderrLog(`[${timestamp}] 📦 Loading response...`);

          // Filter problematic response headers
          const responseHeaders = { ...proxyRes.headers };
          delete responseHeaders["transfer-encoding"];
          delete responseHeaders["content-length"];

          res.writeHead(proxyRes.statusCode || 200, responseHeaders);

          // Stream response data immediately to client
          proxyRes.on("data", (chunk) => {
            res.write(chunk);
          });

          proxyRes.on("end", () => {
            stderrLog(`[${timestamp}] ✅ Response complete`);
            res.end();
          });
        }
      );

      // Handle proxy request errors
      proxyReq.on("error", (e) => {
        console.error(`[${timestamp}] ❌ Proxy request error:`, e);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Proxy error", message: e.message }));
        }
      });

      // Handle client request errors
      req.on("error", (e) => {
        console.error(`[${timestamp}] ❌ Client request error:`, e);
        proxyReq.destroy();
        if (!res.headersSent) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Client error", message: e.message }));
        }
      });

      req.on("data", (chunk) => {
        buffer.push(chunk);
        if(!options.pretty) process.stdout.write(chunk);
        proxyReq.write(chunk);
      });

      req.on("end", () => {
        if(options.pretty) console.log(JSON.stringify(JSON.parse(buffer.join()), null, 2));
        else process.stdout.write("\n");
        console.log(`[${timestamp}] ✅ Request complete`);
        proxyReq.end();
      });

    } catch (e) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ❌ Server error:`, e);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Server error", message: (e as Error).message }));
      }
    }
  });

  server.on("error", (e) => {
    console.error("❌ Server error:", e);
  });

  server.listen(port, () => {
    stderrLog(`✅ Server listening on http://localhost:${port}`);
    stderrLog(`📡 All HTTP request data will be logged to stdout`);
    stderrLog("🤓 Terminal UI messages (such as this one) will be logged to stderr");
  });
});

function stderrLog(item: string, ...items: string[]) {
  let formatted = item;
  if(items.length > 0) {
    formatted += " " + items.join(" ");
  }
  process.stderr.write(formatted + "\n");
}

cli.parse();
