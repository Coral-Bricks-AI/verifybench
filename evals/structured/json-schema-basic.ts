import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { jsonSchemaFormat, MAX_TOKENS } from "../../source/structured.ts";

const schema = {
  type: "object",
  properties: {
    city: { type: "string" },
    country: { type: "string" },
    population_millions: { type: "number" },
    landmarks: { type: "array", items: { type: "string" } },
  },
  required: ["city", "country", "population_millions", "landmarks"],
  additionalProperties: false,
};

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  // The content must be the JSON document alone: no prose, no code fence.
  const value = assert.parsesAsJson(content);
  assert.matchesSchema(value, schema);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "user", content: "Describe Paris, France as structured data, with three landmarks." },
  ],
  response_format: jsonSchemaFormat("city", schema),
  max_tokens: MAX_TOKENS,
};
