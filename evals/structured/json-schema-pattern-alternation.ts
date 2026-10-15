import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { jsonSchemaFormat, MAX_TOKENS } from "../../source/structured.ts";

// Each branch of the alternation carries its own anchors. This is the shape
// that leaked ^ and $ into tool arguments in
// evals/tools/figma-mcp-nodeid-regex-corruption; here it goes through
// response_format instead of a tool definition.
const schema = {
  type: "object",
  properties: {
    nodeId: { type: "string", pattern: "^[0-9]+:[0-9]+$|^[0-9]+-[0-9]+$" },
  },
  required: ["nodeId"],
  additionalProperties: false,
};

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  const value = assert.parsesAsJson(content);
  assert.doesNotMatch(value.nodeId, /\^|\$/);
  assert.match(value.nodeId, /^42[:-]15$/);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "user", content: "The design link points at node 42-15. Extract the node id." },
  ],
  response_format: jsonSchemaFormat("node", schema),
  max_tokens: MAX_TOKENS,
};
