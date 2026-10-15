import OpenAI from "openai";
import * as assert from "./asserts.ts";
import { ChatResult, EvalContext } from "./context.ts";

export type JsonSchema = Record<string, unknown>;

// Every document these evals ask for is a few dozen tokens. The cap bounds
// what a runaway costs: a decoder that never reaches the end of the document
// stops here and fails the eval on an unparseable answer.
export const MAX_TOKENS = 4096;

export function jsonSchemaFormat(name: string, schema: JsonSchema, strict = true) {
  return {
    type: "json_schema" as const,
    json_schema: { name, strict, schema },
  };
}

// Chat Completions with a strict json_schema, where the schema uses a keyword
// that many constrained decoders can't enforce. Two outcomes are correct:
// the provider refuses the schema with a 4xx that says why, or it answers and
// the answer satisfies the schema. Answering with a value that breaks the
// schema means the keyword was dropped without telling the caller.
export async function refusedOrEnforced(ctx: EvalContext, { name, prompt, schema }: {
  name: string,
  prompt: string,
  schema: JsonSchema,
}): Promise<any | undefined> {
  let result: ChatResult;
  try {
    result = await ctx.chat({
      messages: [{ role: "user", content: prompt }],
      response_format: jsonSchemaFormat(name, schema),
      max_tokens: MAX_TOKENS,
    });
  } catch(e) {
    if(e instanceof OpenAI.APIError && typeof e.status === "number" && e.status >= 400 && e.status < 500) {
      assert.ok(e.message.length > 0, "Expected the refusal to carry a message");
      ctx.note("refused the schema");
      return undefined;
    }
    throw e;
  }
  const value = assert.parsesAsJson(result.chatCompletionMessage.content);
  assert.matchesSchema(value, schema);
  ctx.note("enforced");
  return value;
}
