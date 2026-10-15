import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

// OpenAI's newer clients send instructions with the `developer` role in place
// of `system`. It has to be accepted and carry the same weight.
export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  assert.stringContains(String(content ?? ""), "PINEAPPLE");
}

export const json: ChatCompletionCreateParams = {
  messages: [
    { role: "developer", content: "End every reply with the word PINEAPPLE in capitals." },
    { role: "user", content: "What is the capital of France?" },
  ],
};
