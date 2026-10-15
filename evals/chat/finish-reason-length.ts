import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";

// Both spellings of the output limit. OpenAI's SDKs send max_completion_tokens
// for newer models; a provider that reads only max_tokens ignores the limit.
export async function run(ctx: EvalContext) {
  for(const limit of [{ max_tokens: 8 }, { max_completion_tokens: 8 }]) {
    const { finishReason, usage } = await ctx.chat({
      messages: [{ role: "user", content: "Write a 300-word story about a lighthouse keeper." }],
      stream_options: ctx.stream ? { include_usage: true } : undefined,
      ...limit,
    });
    const name = Object.keys(limit)[0];
    assert.strictEqual(finishReason, "length", `finish_reason with ${name}`);
    if(usage) assert.ok(usage.completion_tokens <= 8, `${usage.completion_tokens} completion tokens with ${name}: 8`);
  }
}
