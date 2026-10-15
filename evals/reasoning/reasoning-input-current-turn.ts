import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { currentTurn, probeReasoningField, randomNumberTool } from "../../source/reasoning.ts";

// An agent that thinks between tool calls sends its reasoning back on the
// assistant turn of the turn in progress. Chat templates keep that reasoning
// even when they drop it from earlier turns, so a provider that loses it here
// loses it for every model. Measured by prompt_tokens, not by asking the model.
export async function run(ctx: EvalContext) {
  const probe = await probeReasoningField(ctx, currentTurn, [randomNumberTool]);
  if(probe.found) {
    ctx.note(`reads ${probe.found} (+${probe.growth} prompt tokens)`);
    return;
  }
  if(probe.reason === "no-usage") ctx.skip("usage not reported, so prompt_tokens can't be compared");
  assert.fail("reasoning sent back as reasoning_content, reasoning or reasoning_text adds no prompt tokens: it never reaches the model");
}
