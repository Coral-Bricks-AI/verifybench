import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { messageText } from "../../source/messages.ts";
import { messagesThinkingTokens } from "../../source/effort.ts";

// Claude Code asks every model for reasoning as thinking {type: "adaptive"} with output_config.effort.
// That request has to turn reasoning on, the way thinking {type: "enabled"} does.
export async function run(ctx: EvalContext) {
  const res = await ctx.request("POST", "/messages", {
    model: ctx.model, max_tokens: 16384, thinking: { type: "adaptive" }, output_config: { effort: "high" },
    messages: [{ role: "user", content: "What is 17 times 23? Work it out carefully." }],
  });
  ctx.supported(res, "thinking adaptive");
  assert.status(res, 200);
  const types: string[] = (res.json?.content ?? []).map((b: any) => b.type);
  assert.ok(types.includes("thinking"), `Expected a thinking block for thinking adaptive at effort high, got: ${types.join(", ")}`);
  assert.ok(messagesThinkingTokens(res.json) > 0, "Expected the thinking block to have content");
  assert.stringContains(messageText(res.json), "391");
}
