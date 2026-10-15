import { EvalTestParams } from "../../source/evals.ts";
import * as assert from "../../source/asserts.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

export function test({ chatCompletionMessage: { tool_calls } }: EvalTestParams) {
  assert.isNotNullish(tool_calls);
  assert.isNotEmptyArray(tool_calls);
  assert.strictEqual(tool_calls.length, 1);
  assert.strictEqual(tool_calls[0].type, "function");
  assert.strictEqual(tool_calls[0].function.name, "get_design_context");

  const args = JSON.parse(tool_calls[0].function.arguments);
  assert.match(args.fileKey, /^kL9xQn2VwM8pYrTb4ZcHjF$/);

  // Node IDs from Figma URLs use "123-456" format, and the tool accepts
  // either "123:456" or "123-456". The model may keep the requested form or
  // convert it, but regex anchors from the parameter's `pattern` must never
  // leak into the value. A constrained decoder that compiles ^A$|^B$ into a
  // grammar without treating each ^ and $ as an anchor emits them as
  // literal characters; this has been seen in production deployments.
  assert.doesNotMatch(args.nodeId, /\^|\$/);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    {
      role: "user",
      content:
        "Get the design context for node ID 42-15 in Figma file kL9xQn2VwM8pYrTb4ZcHjF.",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_design_context",
        description:
          "Get design context for a Figma node. Returns structured design data including layout, styles, and component information.",
        parameters: {
          type: "object",
          required: ["nodeId", "fileKey"],
          properties: {
            nodeId: {
              description:
                'The node ID to fetch. Must be in the format "123:456" or "123-456".',
              type: "string",
              pattern: "^[0-9]+:[0-9]+$|^[0-9]+-[0-9]+$",
            },
            fileKey: {
              description: "The Figma file key.",
              type: "string",
            },
          },
        },
      },
    },
  ],
  tool_choice: "auto",
};
