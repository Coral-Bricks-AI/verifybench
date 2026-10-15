import * as assert from "../../source/asserts.ts";
import { DEFAULT_MAX_TOKENS, EvalContext } from "../../source/context.ts";

export async function run(ctx: EvalContext) {
  const queued = await ctx.request("POST", "/responses", {
    model: ctx.model,
    input: "Write a 3000-word essay on the history of the printing press.",
    background: true,
    max_output_tokens: DEFAULT_MAX_TOKENS,
  });
  ctx.supported(queued);
  assert.status(queued, 200);
  const id = queued.json.id;

  const cancelled = await ctx.request("POST", `/responses/${id}/cancel`);
  ctx.supported(cancelled, "POST /responses/{id}/cancel");
  assert.status(cancelled, 200);
  assert.strictEqual(cancelled.json.status, "cancelled");

  // The cancellation sticks: the response doesn't finish behind the caller's back.
  await new Promise(resolve => setTimeout(resolve, 2000));
  const after = await ctx.request("GET", `/responses/${id}`);
  assert.status(after, 200);
  assert.strictEqual(after.json.status, "cancelled");
}
