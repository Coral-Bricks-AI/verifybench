import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { jsonSchemaFormat, MAX_TOKENS } from "../../source/structured.ts";

// The two ways to say "string or null". Both have to reach the decoder as a
// union; a provider that keeps only the first branch can never emit null.
const schema = {
  type: "object",
  properties: {
    first_name: { type: "string" },
    middle_name: { anyOf: [{ type: "string" }, { type: "null" }] },
    nickname: { type: ["string", "null"] },
  },
  required: ["first_name", "middle_name", "nickname"],
  additionalProperties: false,
};

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  const value = assert.parsesAsJson(content);
  assert.matchesSchema(value, schema);
  assert.strictEqual(value.first_name, "Ada");
  assert.strictEqual(value.middle_name, null);
  assert.strictEqual(value.nickname, null);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    {
      role: "user",
      content: "Record this person: first name Ada. She has no middle name and no nickname; use null for anything she doesn't have.",
    },
  ],
  response_format: jsonSchemaFormat("person", schema),
  max_tokens: MAX_TOKENS,
};
