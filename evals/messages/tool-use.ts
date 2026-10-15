import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { toolUses, weatherTool } from "../../source/messages.ts";

export async function run(ctx: EvalContext) {
  const { message, raw } = await ctx.messages({
    max_tokens: 4096,
    tools: [weatherTool],
    messages: [{ role: "user", content: "What's the weather in Paris right now? Use the tool." }],
  });

  assert.status(raw, 200);
  const calls = toolUses(message);
  assert.strictEqual(calls.length, 1);
  const [call] = calls;
  assert.strictEqual(call.name, "get_weather");
  assert.strictEqual(typeof call.id, "string");
  // `input` is an object on this API, where Chat Completions has a JSON string.
  assert.strictEqual(typeof call.input, "object");
  assert.match(call.input.location, /paris/i);
  assert.strictEqual(message.stop_reason, "tool_use");
}
