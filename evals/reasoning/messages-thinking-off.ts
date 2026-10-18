import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { messageText } from "../../source/messages.ts";
import { modelRow } from "../../source/effort.ts";

// thinking {type: "disabled"} turns thinking off, unless the provider says this model always reasons
// (reasoning.mandatory on GET /models), in which case there is nothing to turn off.
export async function run(ctx: EvalContext) {
  const row = await modelRow(ctx);
  if(row?.reasoning?.mandatory === true) ctx.unsupported("the provider lists this model's reasoning as mandatory");
  const res = await ctx.request("POST", "/messages", {
    model: ctx.model, max_tokens: 4096, thinking: { type: "disabled" },
    messages: [{ role: "user", content: "What is 17 times 23? Reply with the number only." }],
  });
  ctx.supported(res, "thinking disabled");
  assert.status(res, 200);
  const types: string[] = (res.json?.content ?? []).map((b: any) => b.type);
  assert.ok(!types.includes("thinking"), `Expected no thinking block with thinking disabled, got: ${types.join(", ")}`);
  assert.stringContains(messageText(res.json), "391");
}
