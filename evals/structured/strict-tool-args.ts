import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { MAX_TOKENS } from "../../source/structured.ts";

const parameters = {
  type: "object",
  properties: {
    title: { type: "string" },
    priority: { type: "string", enum: ["low", "medium", "high"] },
    assignee: { type: ["string", "null"] },
    labels: { type: "array", items: { type: "string" } },
  },
  required: ["title", "priority", "assignee", "labels"],
  additionalProperties: false,
};

export function test({ chatCompletionMessage: { tool_calls } }: EvalTestParams) {
  assert.isNotNullish(tool_calls);
  assert.strictEqual(tool_calls.length, 1);
  const call = tool_calls[0];
  assert.strictEqual(call.type, "function");
  const args = assert.parsesAsJson(call.function.arguments);
  assert.matchesSchema(args, parameters);
  assert.strictEqual(args.priority, "high");
  assert.strictEqual(args.assignee, null);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    {
      role: "user",
      content: "File an issue: the login page crashes on Safari. It is urgent, nobody is assigned yet, and it needs the labels bug and frontend.",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "create_issue",
        description: "Create an issue in the tracker.",
        strict: true,
        parameters,
      },
    },
  ],
  tool_choice: "auto",
  max_tokens: MAX_TOKENS,
};
