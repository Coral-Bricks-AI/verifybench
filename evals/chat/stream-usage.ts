import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";

export async function run(ctx: EvalContext) {
  const { usage, chatCompletionChunks } = await ctx.chat({
    messages: [{ role: "user", content: "Reply with the single word: pong" }],
    stream_options: ctx.stream ? { include_usage: true } : undefined,
  });

  assert.isNotNullish(usage);
  assert.gt(usage.prompt_tokens, 0);
  assert.gt(usage.completion_tokens, 0);
  assert.strictEqual(usage.total_tokens, usage.prompt_tokens + usage.completion_tokens);

  if(chatCompletionChunks === undefined) return;
  // With include_usage, usage arrives once, on a final chunk whose choices
  // array is empty, after the chunk that carries finish_reason.
  const withUsage = chatCompletionChunks.filter(chunk => chunk.usage != null);
  assert.strictEqual(withUsage.length, 1, "chunks that carry usage");
  const last = chatCompletionChunks[chatCompletionChunks.length - 1];
  assert.strictEqual(last, withUsage[0], "usage is on the last chunk");
  assert.deepStrictEqual(last.choices, []);
}
