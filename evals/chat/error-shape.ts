import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";

// SDKs read error.message and error.type off a 4xx body. A 200 with an error
// inside, a 5xx, or an HTML page breaks their retry and reporting logic.
export async function run(ctx: EvalContext) {
  const unknownModel = await ctx.request("POST", "/chat/completions", {
    model: "verifybench-no-such-model",
    messages: [{ role: "user", content: "hi" }],
    max_tokens: 64,
    stream: ctx.stream,
  }, { raw: true });
  assert.status(unknownModel, 400, 404);
  assert.isClientError(unknownModel);

  const noMessages = await ctx.request("POST", "/chat/completions", {
    model: ctx.model,
    max_tokens: 64,
    stream: ctx.stream,
  }, { raw: true });
  assert.status(noMessages, 400, 422);
  assert.isClientError(noMessages);
}
