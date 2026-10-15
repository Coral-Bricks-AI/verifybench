import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { functionCalls, outputText, weatherTool } from "../../source/responses.ts";

// The same round trip with store: false, the way clients that keep their own
// history work: the second request replays the call and its output as input.
export async function run(ctx: EvalContext) {
  const question = { role: "user", content: "What's the weather in Paris right now? Use the tool." };
  const first = await ctx.responses({
    input: [question],
    tools: [weatherTool],
    store: false,
  });
  assert.status(first.raw, 200);
  const calls = functionCalls(first.response);
  assert.strictEqual(calls.length, 1);
  const [call] = calls;

  const second = await ctx.responses({
    input: [
      question,
      { type: "function_call", call_id: call.call_id, name: call.name, arguments: call.arguments },
      { type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ temperature_c: 31, conditions: "sunny" }) },
    ],
    tools: [weatherTool],
    store: false,
  });
  assert.status(second.raw, 200);
  assert.stringContains(outputText(second.response), "31");

  // store: false means what it says.
  const stored = await ctx.request("GET", `/responses/${first.response.id}`);
  assert.status(stored, 404);
}
