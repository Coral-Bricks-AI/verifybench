import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";

// max_tokens is required on this API. The refusal has to come in Anthropic's
// error envelope, which is what the SDK and Claude Code parse.
export async function run(ctx: EvalContext) {
  const res = await ctx.request("POST", "/messages", {
    model: ctx.model,
    stream: ctx.stream,
    messages: [{ role: "user", content: "hi" }],
  }, { raw: true });
  ctx.supported(res);

  assert.status(res, 400);
  assert.strictEqual(res.json?.type, "error");
  assert.strictEqual(res.json.error.type, "invalid_request_error");
  assert.match(res.json.error.message, /max_tokens/);
}
