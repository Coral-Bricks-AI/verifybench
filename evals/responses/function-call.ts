import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { functionCalls, outputText, weatherTool } from "../../source/responses.ts";

// A tool round trip that leans on server-side state: the second request sends
// only the tool's output and the id of the response that asked for it. The
// output doesn't name the city, so an answer that names it had to come from
// the stored first turn. A provider that ignores previous_response_id and
// shows the model a bare tool output can report 31 degrees, but not where.
export async function run(ctx: EvalContext) {
  const first = await ctx.responses({
    input: "What's the weather in Paris right now? Use the tool, then answer in one sentence that names the city and the temperature.",
    tools: [weatherTool],
  });
  assert.status(first.raw, 200);
  const calls = functionCalls(first.response);
  assert.strictEqual(calls.length, 1);
  const [call] = calls;
  assert.strictEqual(call.name, "get_weather");
  assert.strictEqual(typeof call.call_id, "string");
  assert.match(assert.parsesAsJson(call.arguments).location, /paris/i);

  const second = await ctx.responses({
    previous_response_id: first.response.id,
    input: [
      { type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ temperature_c: 31, conditions: "sunny" }) },
    ],
    tools: [weatherTool],
  });
  assert.status(second.raw, 200);
  const text = outputText(second.response);
  assert.stringContains(text, "31");
  assert.match(text, /paris/i, "The answer doesn't name the city: the stored first turn never reached the model");
  assert.strictEqual(second.response.previous_response_id, first.response.id);
}
