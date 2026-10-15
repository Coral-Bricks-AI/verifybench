import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { jsonSchemaFormat, MAX_TOKENS } from "../../source/structured.ts";

const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
  },
  required: ["name"],
  additionalProperties: false,
};

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  const value = assert.parsesAsJson(content);
  // The prompt asks for keys the schema forbids. A strict schema wins.
  assert.deepStrictEqual(Object.keys(value), ["name"]);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    {
      role: "user",
      content: "Return a JSON object for Grace Hopper with the keys name, age, occupation and hobbies.",
    },
  ],
  response_format: jsonSchemaFormat("person", schema),
  max_tokens: MAX_TOKENS,
};
