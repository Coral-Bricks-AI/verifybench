import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

// The prompt points at get_weather; tool_choice names get_time. The named
// function is the one that has to be called.
export function test({ chatCompletionMessage: { tool_calls } }: EvalTestParams) {
  assert.isNotNullish(tool_calls);
  assert.strictEqual(tool_calls.length, 1);
  assert.strictEqual(tool_calls[0].type, "function");
  assert.strictEqual(tool_calls[0].function.name, "get_time");
}

const cityParameters = {
  type: "object",
  properties: { city: { type: "string" } },
  required: ["city"],
};

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "user", content: "What's the weather like in Lisbon?" },
  ],
  tools: [
    {
      type: "function",
      function: { name: "get_weather", description: "Get the current weather in a city.", parameters: cityParameters },
    },
    {
      type: "function",
      function: { name: "get_time", description: "Get the current local time in a city.", parameters: cityParameters },
    },
  ],
  tool_choice: { type: "function", function: { name: "get_time" } },
};
