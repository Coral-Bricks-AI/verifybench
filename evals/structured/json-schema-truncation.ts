import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { jsonSchemaFormat } from "../../source/structured.ts";

const schema = {
  type: "object",
  properties: {
    essay: { type: "string" },
  },
  required: ["essay"],
  additionalProperties: false,
};

// A document cut off by the token limit must say so. Reporting "stop" for a
// truncated document tells the caller it is safe to parse.
export async function run(ctx: EvalContext) {
  const { chatCompletionMessage: { content }, finishReason } = await ctx.chat({
    messages: [{ role: "user", content: "Write a 600-word essay about the history of the bicycle." }],
    response_format: jsonSchemaFormat("essay", schema),
    max_tokens: 40,
  });

  let complete = true;
  try { JSON.parse(String(content ?? "")); } catch { complete = false; }
  if(complete) ctx.skip("the model fit the document inside the limit");
  assert.strictEqual(finishReason, "length");
}
