import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { messageText } from "../../source/messages.ts";

export async function run(ctx: EvalContext) {
  const { message, raw } = await ctx.messages({
    max_tokens: 4096,
    messages: [{ role: "user", content: "Reply with the single word: pong" }],
  });

  assert.status(raw, 200);
  assert.strictEqual(message.type, "message");
  assert.strictEqual(message.role, "assistant");
  assert.strictEqual(typeof message.id, "string");
  assert.strictEqual(typeof message.model, "string");
  assert.match(messageText(message), /pong/i);
  assert.strictEqual(message.stop_reason, "end_turn");
  // input_tokens counts only what was neither read from nor written to the
  // cache, so it can be 0; the three input fields together cannot.
  const { usage } = message;
  assert.strictEqual(typeof usage.input_tokens, "number");
  assert.gt(usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0), 0);
  assert.gt(usage.output_tokens, 0);
}
