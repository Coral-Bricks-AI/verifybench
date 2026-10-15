import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

// On Responses, reasoning is its own output item ahead of the message, never
// text mixed into the answer.
export async function run(ctx: EvalContext) {
  const { response, raw } = await ctx.responses({
    input: "What is 17 times 23? Work it out carefully.",
    reasoning: { effort: ctx.reasoningEffort ?? "high", summary: "auto" },
  });

  assert.status(raw, 200);
  const types: string[] = response.output.map((item: any) => item.type);
  assert.ok(types.includes("reasoning"), `Expected a reasoning item, got: ${types.join(", ")}`);
  assert.ok(types.indexOf("reasoning") < types.indexOf("message"), "Expected reasoning before the message");

  const text = outputText(response);
  assert.stringContains(text, "391");
  assert.doesNotMatch(text, /<\/?think>/);
  assert.gt(response.usage?.output_tokens_details?.reasoning_tokens ?? 0, 0);
}
