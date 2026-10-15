import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { jsonSchemaFormat } from "../../source/structured.ts";

const schema = {
  type: "object",
  properties: {
    answer: { type: "integer" },
  },
  required: ["answer"],
  additionalProperties: false,
};

// Under a grammar, the end-of-sequence token is only legal once the document
// is complete. Two ways this goes wrong: the decoder never allows it and the
// model pads with whitespace until the token limit, or it is allowed early
// and the document is cut off while the response still claims a clean stop.
export async function run(ctx: EvalContext) {
  const { chatCompletionMessage: { content }, finishReason, usage } = await ctx.chat({
    messages: [{ role: "user", content: "What is 6 times 7?" }],
    response_format: jsonSchemaFormat("answer", schema),
    max_tokens: 4096,
    stream_options: ctx.stream ? { include_usage: true } : undefined,
  });

  assert.strictEqual(finishReason, "stop");
  const value = assert.parsesAsJson(content);
  assert.strictEqual(value.answer, 42);
  // Nothing after the closing brace beyond a single newline.
  assert.match(content as string, /\}\n?$/);
  if(usage) {
    const reasoning = usage.completion_tokens_details?.reasoning_tokens ?? 0;
    const visible = usage.completion_tokens - reasoning;
    assert.ok(visible < 200, `${visible} visible completion tokens for a 12-character document`);
  }
}
