import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

// The prompt calls for the tool; tool_choice: "none" forbids it. The reply has
// to be text, and the call must not leak into the text as raw markup either.
export function test({ chatCompletionMessage: { tool_calls, content } }: EvalTestParams) {
  assert.ok(tool_calls == null || tool_calls.length === 0, "Expected no tool calls");
  const text = String(content ?? "");
  assert.ok(text.trim().length > 0, "Expected a text reply");
  assert.doesNotMatch(text, /<tool_call>|<\|tool|"name"\s*:\s*"get_weather"/);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "user", content: "What's the weather like in Lisbon right now?" },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get the current weather in a city.",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    },
  ],
  tool_choice: "none",
};
