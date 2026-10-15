import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { MAX_TOKENS } from "../../source/structured.ts";

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  const value = assert.parsesAsJson(content);
  assert.strictEqual(typeof value, "object");
  assert.isNotNullish(value);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "user", content: "Return a JSON object with the keys color and hex for the color red." },
  ],
  response_format: { type: "json_object" },
  max_tokens: MAX_TOKENS,
};
