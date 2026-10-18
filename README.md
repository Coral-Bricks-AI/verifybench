# verifybench

Correctness checks for LLM inference providers. verifybench sends the same
requests to any OpenAI-compatible (and Anthropic-compatible) endpoint and
checks the answers for the bugs that break agents and integrations: tool calls
that don't parse, reasoning that leaks into the answer or is dropped from
history, structured output that ignores the schema, stop sequences and token
limits that aren't applied, and Responses and Messages routes that don't
behave like the APIs they copy.

verifybench is a fork of [Synbad](https://github.com/synthetic-lab/synbad) by
Synthetic Lab (Matt Baker and Billy Cao). It keeps Synbad's eval format and
its original evals, and adds the Responses and Messages routes, structured
output, an explicit result status model and a versioned eval set.

## Install

```bash
npm install -g verifybench
```

Or run it from this repo (Node 20.11 or newer, or Bun):

```bash
bun install
bun run build
./verifybench.sh eval --env-var YOUR_API_KEY --base-url https://api.provider.com/v1 --model your-model
```

`bun run typecheck` and `bun run test` check the code and the manifest.

## Running verifybench

```bash
verifybench eval --env-var YOUR_API_KEY \
  --base-url "https://api.provider.com/v1" \
  --model "your-model" \
  --provider your-provider \
  --report results.json
```

Useful flags:

- `--stream` runs the streaming form of every route. Run the suite once with
  and once without it; see "Canonical use".
- `--skip responses,messages` leaves out eval directories, for a provider that
  only offers Chat Completions. `--skip-reasoning` is short for `--skip reasoning`.
- `--only evals/tools/simple-tool` runs one eval or one directory.
- `--reasoning-effort high` is needed for the reasoning evals on models that
  don't reason by default.
- `--count 5` takes five samples of every behaviour eval and reports its pass
  rate and verdict (see "Verdicts"). Protocol evals always run once. Use at
  least `--count 3` for a canonical run.
- `--provider name` is recorded in the report (default: the base URL's host).
- `--report results.json` writes the results as JSON (see below).
- `--retry-429` waits out rate limits for longer (12 tries, 10 s apart), for
  accounts with a low request rate.
- `--timeout 600` is the per-request timeout in seconds.

The exit code is 1 when any eval failed, 2 when none failed but some ended in
`infra_error` (rerun those), and 0 otherwise.

`verifybench manifest` prints the eval set. `verifybench proxy -p 3000 -t
https://api.provider.com/v1` logs the requests a client sends, to capture
reproducible JSON for a new eval.

## Canonical use

### The eval set

`evals/manifest.json` is the eval set. It has a version (currently **1.1.0**)
and one entry per eval:

```json
{
  "id": "chat/stop-sequence",
  "version": 1,
  "route": "chat",
  "capability": "stop-sequences",
  "origin": "verifybench",
  "kind": "protocol",
  "criterion": "`stop` applies to the visible content, not to reasoning: ..."
}
```

- `id` is stable: the eval's path under `evals/`.
- `version` goes up whenever the request or the pass criterion changes.
  Results are comparable only on the same id and version.
- `route` is `chat`, `responses`, `messages` or `raw` (plain HTTP).
- `origin` is `synbad` for evals inherited from Synbad and `verifybench` for
  the ones written here (see "Evals from Synbad").
- `kind` is `protocol` (the API contract: deterministic given a correct
  endpoint, run once) or `behaviour` (what the model does with a correct
  request: sampled with `--count`, reported as a pass rate).
- `modes`, when present, lists the only forms the eval applies to, e.g.
  `["stream"]` for stream event order. It isn't run in the other mode.
- `criterion` is the pass criterion in one line. When an eval and its
  criterion disagree, the criterion is what the eval is meant to check, and the
  eval is the bug.

The set version follows semver: a new eval or a criterion change bumps the
minor version, a removed eval or a changed status rule the major version.

### Statuses

Every eval ends in one of these:

| Status | Meaning |
|---|---|
| `pass` | The endpoint accepted the request and answered correctly. |
| `fail` | The endpoint accepted the request and answered wrongly. A 4xx that rejects a valid request without saying the feature is unsupported also counts: the request was valid, the answer is wrong. |
| `unsupported` | The route or feature isn't offered: HTTP 404, 405 or 501, or a 400/422 whose error names the parameter or feature as unsupported. Also used where the model, not the provider, rules a check out (see `reasoning/preserve-injected-reasoning`). Not a failure. |
| `infra_error` | HTTP 429 after retries, a 5xx, a timeout or a dropped connection. Says nothing about correctness; rerun it. |
| `skipped` | This sample couldn't exercise what the eval checks, e.g. the model finished inside a limit that was meant to cut it off. |

A provider is correct on an eval when it passes or reports the feature as
unsupported. Saying "not supported" is always better than accepting a
parameter and ignoring it: the second is what fails.

A behaviour eval's status is `fail` when any scored sample failed; how bad
that is, is what the verdict says.

### Verdicts

Every eval that ended in `pass` or `fail` gets a verdict. `unsupported`,
`infra_error` and `skipped` get none and are counted separately.

| Verdict | Protocol eval | Behaviour eval (`--count N`) |
|---|---|---|
| **full support** | passed | every scored sample passed |
| **passable** | never: the contract holds or it doesn't | at least half the scored samples passed (pass rate >= 0.5) |
| **not acceptable** | failed | fewer than half passed |

Scored samples are those that ended in pass or fail; a sample lost to an
infra error isn't counted either way. With `--count 3` that means 3/3 is full,
2/3 passable and 1/3 or 0/3 not acceptable. With `--count 1` a behaviour eval
can only be full or not acceptable, which is why canonical runs use 3 or more.

Verdicts roll up by taking the worst:

- per capability (the manifest's `capability` field): full only if every
  graded eval of that capability is full, not acceptable if any is;
- per run: the worst capability, plus the count of evals at each verdict;
- across modes: an eval or capability is only as good as its worse mode
  (the stream rule below).

The report carries all three (`verdict` on each result; `verdicts`,
`verdict` and `capabilities` at the top), and the matrix shows them.

### Output caps

Every request that generates has an output cap, so a provider that never
stops costs a bounded amount. Evals that set none get the runner's default,
16384 tokens (`max_tokens` on Chat Completions, `max_output_tokens` on
Responses): enough for a reasoning model at high effort to think and still
answer. Evals that set their own keep it: the structured evals use 4096 (their
documents are a few dozen tokens), the Messages evals 4096 or 8192, the
captured agent loops 32000 and 60000, and a few evals set small limits on
purpose (`finish-reason-length` 8, `json-schema-truncation` 40). The default
is recorded in each report as `defaultMaxTokens`.

### The stream rule

Every route can be called streamed or not, and the two go through different
code. Run the suite twice, with and without `--stream`, and report both. An
eval's verdict for a provider is the worse of its two modes (or the one mode
its manifest entry lists): full support means full support in both.

### Reporting results

Publish, for each run:

- the report JSON (`--report`), unedited. It carries the eval-set version,
  each eval's id and version, the status, the pass rate and the failure detail;
- the date of the run;
- the model id exactly as sent, and the endpoint (base URL);
- the reasoning effort and `--count`, when used.

Keep the files in this layout:

```
results/<set-version>/<provider>/<model>/nonstream.json
results/<set-version>/<provider>/<model>/stream.json
```

with `/` in a model id replaced by `__`. Results from different set versions
aren't comparable; rerun instead of mixing them.

### The matrix

`verifybench matrix` builds the provider x eval table from report files, with a
non-streaming and a streaming column per provider and model. Graded cells show
the verdict (`.` full, `~` passable with the sample count, `X` not acceptable),
the rest their status; below the evals come the capability roll-up, the
counts per verdict and status, and the run's verdict:

```bash
verifybench matrix results/1.1.0/*/*/*.json            # rows that didn't pass somewhere
verifybench matrix --all --format md results/1.1.0/*/*/*.json
```

`--format` is `text` (default), `md` or `json`. Older report files (before
verdicts) are graded on the fly with the same rules.

### Report format

```json
{
  "format": 3,
  "tool": { "name": "verifybench", "version": "0.2.0" },
  "manifest": { "name": "verifybench", "version": "1.1.0" },
  "provider": "example", "model": "some-model", "baseUrl": "https://api.example.com/v1",
  "stream": false, "reasoningEffort": "high", "count": 3,
  "defaultMaxTokens": 16384, "passableRate": 0.5,
  "startedAt": "...", "finishedAt": "...",
  "totals": { "pass": 60, "fail": 3, "unsupported": 2, "infra_error": 0, "skipped": 0 },
  "verdicts": { "full": 60, "passable": 1, "not_acceptable": 2 },
  "verdict": "not_acceptable",
  "capabilities": {
    "tool-calls": { "verdict": "full", "evals": 9, "verdicts": { "full": 9, "passable": 0, "not_acceptable": 0 }, "ungraded": {} }
  },
  "results": [
    {
      "id": "tools/parallel-tool", "version": 1, "kind": "behaviour", "route": "chat",
      "capability": "parallel-tool-calls", "origin": "synbad", "status": "pass", "verdict": "full",
      "samples": 3, "sampleStatuses": { "pass": 3 }, "passRate": 1, "ms": 4210
    }
  ]
}
```

Failure details hold the provider's answer, never local paths: verifybench
replaces the home folder with `~` before writing them.

## Contributing

All evals live in `evals/` and are written in TypeScript. A new eval needs an
entry in `evals/manifest.json` (the runner refuses to run an eval without one,
and `bun run test` checks that the two match). Changing what an existing eval
sends or checks means bumping its `version` there.

The simplest eval exports two things:

1. The JSON that reproduces the problem, as the const `json`. It doesn't have to
   reproduce it every time; if the bug appears even 5% of the time, make it a
   `behaviour` eval and sample it with `--count`.
2. A `test` function that runs asserts on the returned assistant message.

For example, `evals/tools/parallel-tool.ts`:

```typescript
import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";

export function test({ chatCompletionMessage: { tool_calls } }: EvalTestParams) {
  assert.isNotNullish(tool_calls);
  assert.isNotEmptyArray(tool_calls);
  assert.strictEqual(tool_calls.length, 2);
}

export const json = {
  "messages": [
    {"role": "user", "content": "What's the weather in Paris and London?"}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "parameters": {
          "type": "object",
          "properties": { "location": { "type": "string", "description": "City name" } },
          "required": ["location"]
        }
      }
    }
  ],
  "parallel_tool_calls": true,
  "tool_choice": "auto",
}
```

`source/asserts.ts` re-exports Node's assertion functions and adds a few, e.g.
`isNotNullish`, `parsesAsJson` and `matchesSchema`.

`verifybench.sh` recompiles everything, your new eval included, before it runs:

```bash
./verifybench.sh eval --env-var YOUR_API_KEY \
  --base-url "https://api.provider.com/v1" \
  --only evals/reasoning/reasoning-parsing \
  --model "some-model" \
  --count 5
```

### Evals that make their own requests

The `json` + `test` form covers one Chat Completions request. An eval that
needs more (several requests, the Responses or Messages routes, an assert on a
status code or on the order of stream events) exports a `run` function instead
and gets a context:

```typescript
import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

export async function run(ctx: EvalContext) {
  const first = await ctx.responses({ input: "Remember the word zanzibar. Reply with OK." });
  const second = await ctx.responses({
    previous_response_id: first.response.id,
    input: "What was the word?",
  });
  assert.stringContains(outputText(second.response), "zanzibar");
}
```

- `ctx.chat(json)`, `ctx.responses(body)` and `ctx.messages(body)` call
  `/chat/completions`, `/responses` and `/messages`. Each streams when
  verifybench was started with `--stream` and hands back the same final object
  either way, plus the raw events when streamed. A route that answers 404, 405
  or 501, or a 400 that says the feature is unsupported, ends the eval as
  `unsupported`.
- `ctx.request(method, path, body)` is a plain HTTP call for asserting on
  status codes and error bodies and for routes such as `GET /responses/{id}`.
  It retries 429s and 5xx and then ends the eval as `infra_error`; every other
  status is handed back. Pass `{ raw: true }` as the fourth argument when the
  5xx itself is what the eval checks (the error-shape evals do).
- `ctx.supported(res, what)` ends the eval as `unsupported` when a raw response
  says the route or feature isn't offered.
- `ctx.unsupported(reason)` and `ctx.skip(reason)` end the eval as
  `unsupported` or `skipped` directly.
- `ctx.note(text)` attaches a remark to a pass. The schema keyword evals use it
  to record whether the provider enforced a keyword or refused it; both are
  correct, and only a value that breaks the schema is a failure.

### What the directories cover

| Directory | Route | What it checks |
|---|---|---|
| `evals/tools` | Chat Completions | Tool call parsing, parallel calls, `tool_choice`, argument corruption, tool history |
| `evals/reasoning` | all three | Reasoning kept apart from the answer, accepted back in history, and controlled by each harness's effort setting |
| `evals/structured` | Chat Completions | `response_format` and strict tools: regex anchors in `pattern`, enum escaping, `$ref`, nullable unions, schema keywords a decoder may drop, clean termination of the document |
| `evals/chat` | Chat Completions | Stop sequences, output limits, usage in streams, logprobs, error bodies, the `developer` role |
| `evals/responses` | Responses | Output items, stream event order, `previous_response_id`, tool round trips with and without stored state, retrieve and delete, background mode, cancel |
| `evals/messages` | Anthropic Messages | Content blocks, stream event order, tool use and tool results, system blocks with `cache_control`, token counting, the error envelope |

Every structured eval sets `max_tokens`. A decoder that never reaches the end
of a document would otherwise generate until the provider's own limit, on the
caller's bill.

### Reasoning fields

Chat Completions has no standard field for reasoning. Providers return it as
`reasoning_content`, `reasoning` or `reasoning_text`; read it with
`getReasoning(message)` from `source/chat-completion.ts` so an eval works with
all of them.

Sending reasoning back in history has the same problem. The reasoning-input
evals (`reasoning/preserve-injected-reasoning*`,
`reasoning/reasoning-input-current-turn`) first find which of the three fields
the provider reads, by sending each and comparing `prompt_tokens`. Many chat
templates drop reasoning from turns before the last user message by design;
when the provider reads reasoning on the current turn but an earlier turn's
reasoning adds no prompt tokens, the earlier-turn evals report `unsupported`
for that model instead of failing. A gateway that strips earlier-turn
reasoning itself looks the same from outside.

### Reasoning effort

Every harness asks for reasoning its own way, and a provider that honours only one of them leaves the
others' users with no reasoning or no control over it (until the user writes a hand-made config):

| Harness | How it asks | Evals |
|---|---|---|
| Claude Code | Messages: `thinking: {type: "adaptive"}` + `output_config.effort` | `reasoning/messages-adaptive`, `reasoning/messages-effort-scales` |
| Codex | Responses: `reasoning.effort` (incl. `minimal`, `xhigh`), `store: false` + `include: ["reasoning.encrypted_content"]`, reasoning items sent back as input | `reasoning/responses-effort-scales`, `reasoning/responses-encrypted-roundtrip`, `reasoning/effort-names` |
| OpenCode, Pi, most SDKs | Chat Completions: `reasoning_effort` (incl. `none`) | `reasoning/chat-effort-scales`, `reasoning/effort-names` |
| Anything that turns thinking off | Messages: `thinking: {type: "disabled"}` | `reasoning/messages-thinking-off` |
| Any harness that configures itself | `GET /models` saying whether a model reasons and which efforts it takes | `reasoning/models-reasoning-metadata` |

The `*-effort-scales` evals check that every effort the model offers means something: they read the
model's efforts from `GET /models` (else `low` and `high`), ask a question that takes real work three times
at each, and need each step up to reason at least 20% more than the one below, by median. One sample is
not enough: reasoning length varies about two-fold from run to run.

## Evals from Synbad

These 15 evals come from [Synbad](https://github.com/synthetic-lab/synbad) by
Synthetic Lab, under the MIT license, and keep their original names. Each file
starts with a comment saying so and listing any change; the manifest marks
them `"origin": "synbad"`.

| Eval | Changed here |
|---|---|
| `reasoning/multiturn-reasoning-parsing` | no |
| `reasoning/reasoning-claude-tool-call` | system prompt and Bash tool descriptions replaced with neutral stand-ins |
| `reasoning/reasoning-parsing` | no |
| `reasoning/response-in-reasoning` | task tool description rewritten shorter and neutral |
| `tools/claude-dash` | system prompt, tool descriptions, todo reminder and tool-result text replaced with neutral stand-ins |
| `tools/crush-list-files` | system prompt and tool descriptions replaced with neutral stand-ins; working directory `/home/user/scratch-scripts` |
| `tools/multi-turn-tools` | no |
| `tools/no-fn-args` | no |
| `tools/octo-list-no-optional-args` | no |
| `tools/parallel-tool` | no |
| `tools/simple-tool` | no |
| `tools/stream-multi-tool` | no |
| `tools/tool-dash-underscore` | no |
| `tools/tool-finish-reason` | no |
| `tools/tool-path-corruption` | no |

The stand-ins replace text captured from real coding agents (their system
prompts and tool descriptions); tool names, parameter schemas, conversation
shapes and assertions are as in Synbad. All of them also run under the
runner's default output cap where they set none (see "Output caps"). The
eval format, the `json` + `test` contract and `getReasoning` come from
Synbad too.

## License

MIT. See [LICENSE](LICENSE).
