import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";

// Harnesses ask for reasoning effort by name, and not all with the same names: OpenAI documents
// low/medium/high, Codex also sends minimal and xhigh, OpenCode and Pi send none. Every one of them
// must be taken (mapped onto what the model offers), and a name that means nothing must be refused,
// not silently ignored.
export async function run(ctx: EvalContext) {
  const ask = (effort: string) => ctx.request("POST", "/chat/completions", {
    model: ctx.model, max_tokens: 4096, reasoning_effort: effort,
    messages: [{ role: "user", content: "Reply with the word ok." }],
  });
  const low = await ask("low");
  ctx.supported(low, "reasoning_effort");
  assert.status(low, 200);
  const refused: string[] = [];
  for(const effort of ["none", "minimal", "medium", "high", "xhigh"]) {
    const res = await ask(effort);
    if(res.status !== 200) refused.push(`${effort} → ${res.status}`);
  }
  assert.ok(refused.length === 0, `Effort names harnesses send were refused: ${refused.join(", ")}`);
  const nonsense = await ask("turbo");
  assert.ok(nonsense.status === 400 || nonsense.status === 422, `An unknown effort ("turbo") should be refused with 400, got ${nonsense.status}`);
}
