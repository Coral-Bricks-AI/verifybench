import OpenAI from "openai";
import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";

// logprobs is either honoured or refused. Returning a normal answer with no
// logprobs leaves a caller that depends on them (classifiers, confidence
// scores) reading nothing, with no error to act on.
export async function run(ctx: EvalContext) {
  // Not streamed: the assembled stream message carries no logprobs to assert on.
  if(ctx.stream) ctx.skip("checked without streaming");
  let completion: OpenAI.ChatCompletion;
  try {
    completion = await ctx.openai.chat.completions.create({
      model: ctx.model,
      messages: [{ role: "user", content: "Reply with the single word: yes" }],
      logprobs: true,
      top_logprobs: 2,
      max_tokens: 2048,
    });
  } catch(e) {
    if(e instanceof OpenAI.APIError && typeof e.status === "number" && e.status >= 400 && e.status < 500) {
      ctx.note("refused logprobs");
      return;
    }
    throw e;
  }

  const tokens = completion.choices[0].logprobs?.content;
  assert.isNotNullish(tokens);
  assert.isNotEmptyArray(tokens);
  for(const token of tokens) {
    assert.strictEqual(typeof token.token, "string");
    assert.ok(token.logprob <= 0, `logprob ${token.logprob} is above 0`);
    assert.strictEqual(token.top_logprobs.length, 2);
  }
  ctx.note("returned logprobs");
}
