import * as assert from "../../source/asserts.ts";
import { DEFAULT_MAX_TOKENS, EvalContext, parseSse } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

// Fire and collect. Without --stream the result is polled; with --stream a
// second connection attaches to the response while it runs.
export async function run(ctx: EvalContext) {
  const queued = await ctx.request("POST", "/responses", {
    model: ctx.model,
    input: "Reply with the single word: pong",
    background: true,
    max_output_tokens: DEFAULT_MAX_TOKENS,
  });
  ctx.supported(queued);
  assert.status(queued, 200);
  assert.ok(["queued", "in_progress", "completed"].includes(queued.json.status), `status ${queued.json.status}`);
  assert.strictEqual(queued.json.background, true);
  const id = queued.json.id;

  if(ctx.stream) {
    const attached = await ctx.request("GET", `/responses/${id}?stream=true`);
    assert.status(attached, 200);
    const events = parseSse(attached.text);
    const last = events[events.length - 1];
    assert.strictEqual(last?.data?.type, "response.completed");
    assert.match(outputText(last.data.response), /pong/i);
    return;
  }

  const deadline = Date.now() + 120_000;
  while(true) {
    const current = await ctx.request("GET", `/responses/${id}`);
    assert.status(current, 200);
    if(current.json.status === "completed") {
      assert.match(outputText(current.json), /pong/i);
      return;
    }
    assert.ok(["queued", "in_progress"].includes(current.json.status), `status ${current.json.status}`);
    assert.ok(Date.now() < deadline, "Still not completed after 120 s");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
