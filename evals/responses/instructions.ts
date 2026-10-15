import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

// `instructions` is the Responses counterpart of a system message, and input
// may be a list of messages instead of a string.
export async function run(ctx: EvalContext) {
  const { response, raw } = await ctx.responses({
    instructions: "End every reply with the word PINEAPPLE in capitals.",
    input: [
      { role: "user", content: [{ type: "input_text", text: "What is the capital of France?" }] },
    ],
  });

  assert.status(raw, 200);
  const text = outputText(response);
  assert.stringContains(text, "Paris");
  assert.stringContains(text, "PINEAPPLE");
}
