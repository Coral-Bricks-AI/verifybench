import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { messageText, toolUses, weatherTool } from "../../source/messages.ts";

// The history a coding agent sends on every turn after its first tool call:
// an assistant turn with text and tool_use, then a user turn with tool_result.
export async function run(ctx: EvalContext) {
  const { message, raw } = await ctx.messages({
    max_tokens: 4096,
    tools: [weatherTool],
    messages: [
      { role: "user", content: "What's the weather in Paris right now?" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll look that up." },
          { type: "tool_use", id: "toolu_01A09q90qw90lq917835lq9", name: "get_weather", input: { location: "Paris" } },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_01A09q90qw90lq917835lq9",
            content: [{ type: "text", text: JSON.stringify({ temperature_c: 31, conditions: "sunny" }) }],
          },
        ],
      },
    ],
  });

  assert.status(raw, 200);
  assert.strictEqual(toolUses(message).length, 0);
  assert.stringContains(messageText(message), "31");
  assert.strictEqual(message.stop_reason, "end_turn");
}
