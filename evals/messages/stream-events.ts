import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";

// The Anthropic SDK is a state machine over these events: a block that is
// never closed, or a delta for a block that was never opened, throws.
export async function run(ctx: EvalContext) {
  if(!ctx.stream) ctx.skip("streaming only");
  const { events, raw } = await ctx.messages({
    max_tokens: 4096,
    messages: [{ role: "user", content: "Count from one to five in words." }],
  });
  assert.status(raw, 200);
  assert.isNotNullish(events);

  const seen = events.filter(event => event.data?.type !== "ping");
  assert.isNotEmptyArray(seen);
  for(const { event, data } of seen) {
    // The SSE event name repeats the type inside the payload.
    assert.strictEqual(event, data.type);
  }

  const types = seen.map(event => event.data.type);
  assert.strictEqual(types[0], "message_start");
  assert.strictEqual(types[types.length - 1], "message_stop");
  assert.strictEqual(types[types.length - 2], "message_delta");

  const open = new Set<number>();
  let blocks = 0;
  for(const { data } of seen) {
    if(data.type === "content_block_start") {
      assert.strictEqual(data.index, blocks, "content block indexes count up from 0");
      assert.strictEqual(open.size, 0, "a block opened before the previous one closed");
      open.add(data.index);
      blocks++;
    }
    if(data.type === "content_block_delta") {
      assert.ok(open.has(data.index), `delta for block ${data.index}, which is not open`);
    }
    if(data.type === "content_block_stop") {
      assert.ok(open.delete(data.index), `stop for block ${data.index}, which is not open`);
    }
  }
  assert.strictEqual(open.size, 0, "a block was left open");
  assert.gt(blocks, 0);

  const start = seen[0].data.message;
  assert.strictEqual(start.role, "assistant");
  assert.deepStrictEqual(start.content, []);
  assert.strictEqual(typeof start.usage.input_tokens, "number");

  const delta = seen[seen.length - 2].data;
  assert.strictEqual(delta.delta.stop_reason, "end_turn");
  // Harmless to the official SDKs, which read the delta field by field, but a
  // client that merges the delta into the message ends up with the wrong type.
  if("type" in delta.delta) ctx.note("message_delta.delta carries a `type` key, which Anthropic's does not");
  assert.gt(delta.usage.output_tokens, 0);
}
