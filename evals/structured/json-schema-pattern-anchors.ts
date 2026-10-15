import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { jsonSchemaFormat, MAX_TOKENS } from "../../source/structured.ts";

const schema = {
  type: "object",
  properties: {
    ticket: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$" },
  },
  required: ["ticket"],
  additionalProperties: false,
};

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  const value = assert.parsesAsJson(content);
  // A decoder that compiles `pattern` into a grammar must treat ^ and $ as
  // anchors. Treating them as literal characters puts them in the value.
  assert.doesNotMatch(value.ticket, /\^|\$/);
  assert.strictEqual(value.ticket, "QRX-4821");
}

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "user", content: "The customer wrote in about ticket QRX-4821. Extract the ticket id." },
  ],
  response_format: jsonSchemaFormat("ticket", schema),
  max_tokens: MAX_TOKENS,
};
