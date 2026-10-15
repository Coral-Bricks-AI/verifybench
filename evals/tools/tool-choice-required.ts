import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

// Nothing in the prompt calls for a tool; tool_choice: "required" forces one.
export function test({ chatCompletionMessage: { tool_calls } }: EvalTestParams) {
  assert.isNotNullish(tool_calls);
  assert.isNotEmptyArray(tool_calls);
  assert.strictEqual(tool_calls[0].type, "function");
  assert.parsesAsJson(tool_calls[0].function.arguments);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "user", content: "Hello there! How are you today?" },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "log_greeting",
        description: "Record that the user greeted the assistant.",
        parameters: {
          type: "object",
          properties: { mood: { type: "string" } },
          required: ["mood"],
        },
      },
    },
  ],
  tool_choice: "required",
};
