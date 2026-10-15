import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

// Clients build the response from these events as they arrive, so the order
// and the bookkeeping fields matter as much as the text.
export async function run(ctx: EvalContext) {
  if(!ctx.stream) ctx.skip("streaming only");
  const { response, events, raw } = await ctx.responses({ input: "Count from one to five in words." });
  assert.status(raw, 200);
  assert.isNotNullish(events);
  assert.isNotEmptyArray(events);

  const types = events.map(event => event.data?.type);
  assert.strictEqual(types[0], "response.created");
  assert.strictEqual(types[types.length - 1], "response.completed");
  assert.strictEqual(types.filter(type => type === "response.completed").length, 1);

  let lastSequence = -1;
  for(const { event, data } of events) {
    // The SSE event name repeats the type inside the payload.
    assert.strictEqual(event, data.type);
    assert.strictEqual(typeof data.sequence_number, "number", `sequence_number on ${data.type}`);
    assert.gt(data.sequence_number, lastSequence);
    lastSequence = data.sequence_number;
  }

  // The ordering checks apply to the message item. A reasoning item (or any
  // other) may come first with its own added/done pair, so the events are
  // matched on the message's output_index, not on the first of each type.
  const added = events.find(event => event.data.type === "response.output_item.added" && event.data.item?.type === "message");
  assert.ok(added, "Expected a response.output_item.added event for a message item");
  const messageIndex = added.data.output_index;
  const order = (type: string) => {
    const index = events.findIndex(event => event.data.type === type && event.data.output_index === messageIndex);
    assert.ok(index !== -1, `Expected a ${type} event for the message item (output_index ${messageIndex})`);
    return index;
  };
  // An item is announced before its content part, and the part before its text.
  assert.ok(order("response.output_item.added") < order("response.content_part.added"));
  assert.ok(order("response.content_part.added") < order("response.output_text.delta"));
  assert.ok(order("response.output_text.delta") < order("response.output_text.done"));
  assert.ok(order("response.output_text.done") < order("response.output_item.done"));

  const deltas = events
    .filter(event => event.data.type === "response.output_text.delta")
    .map(event => event.data.delta)
    .join("");
  const done = events.find(event => event.data.type === "response.output_text.done")!;
  assert.strictEqual(deltas, done.data.text);
  assert.strictEqual(deltas, outputText(response));
  assert.strictEqual(response.status, "completed");
}
