import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

// The second request carries no history of its own: the server has to supply it.
export async function run(ctx: EvalContext) {
  const first = await ctx.responses({
    input: "Remember this code word for later: zanzibar-42. Reply with OK.",
  });
  assert.status(first.raw, 200);

  const second = await ctx.responses({
    previous_response_id: first.response.id,
    input: "What was the code word?",
  });
  assert.status(second.raw, 200);
  assert.stringContains(outputText(second.response).toLowerCase(), "zanzibar-42");
  assert.strictEqual(second.response.previous_response_id, first.response.id);
}
