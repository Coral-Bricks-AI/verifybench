import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { jsonSchemaFormat, MAX_TOKENS } from "../../source/structured.ts";

// strict: false with a property left out of `required`. This is what most
// hand-written schemas look like; a provider must accept it, not demand the
// strict-mode shape.
const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
  },
  required: ["title"],
};

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  const value = assert.parsesAsJson(content);
  assert.matchesSchema(value, schema);
  assert.match(value.title, /dune/i);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "user", content: "Give me the title of Frank Herbert's 1965 novel about Arrakis." },
  ],
  response_format: jsonSchemaFormat("book", schema, false),
  max_tokens: MAX_TOKENS,
};
