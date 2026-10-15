import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { weatherTool } from "../../source/messages.ts";

// Claude Code calls this to decide when to compact.
export async function run(ctx: EvalContext) {
  const body = {
    model: ctx.model,
    system: "You are a terse assistant.",
    tools: [weatherTool],
    messages: [{ role: "user", content: "What's the weather in Paris right now?" }],
  };
  const short = await ctx.request("POST", "/messages/count_tokens", body);
  ctx.supported(short);
  assert.status(short, 200);
  assert.gt(short.json.input_tokens, 0);

  const long = await ctx.request("POST", "/messages/count_tokens", {
    ...body,
    messages: [{ role: "user", content: "What's the weather in Paris right now? ".repeat(50) }],
  });
  assert.status(long, 200);
  assert.gt(long.json.input_tokens, short.json.input_tokens + 100);
}
