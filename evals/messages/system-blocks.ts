import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { messageText } from "../../source/messages.ts";

// Claude Code sends `system` as a list of text blocks with cache_control
// markers, and marks message blocks the same way. The markers have to be
// accepted, and every system block has to reach the model.
export async function run(ctx: EvalContext) {
  const { message, raw } = await ctx.messages({
    max_tokens: 4096,
    system: [
      { type: "text", text: "You are a terse assistant." },
      { type: "text", text: "End every reply with the word PINEAPPLE in capitals.", cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What is the capital of France?", cache_control: { type: "ephemeral" } },
        ],
      },
    ],
  });

  assert.status(raw, 200);
  const text = messageText(message);
  assert.stringContains(text, "Paris");
  assert.stringContains(text, "PINEAPPLE");
}
