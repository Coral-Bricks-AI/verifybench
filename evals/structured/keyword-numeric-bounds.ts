import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { refusedOrEnforced } from "../../source/structured.ts";

// The prompt supplies a number outside the allowed range.
const schema = {
  type: "object",
  properties: {
    rating: { type: "integer", minimum: 1, maximum: 5 },
  },
  required: ["rating"],
  additionalProperties: false,
};

export async function run(ctx: EvalContext) {
  const value = await refusedOrEnforced(ctx, {
    name: "numeric_bounds",
    prompt: "A reviewer wrote: \"Eleven out of ten, would buy again.\" Record the rating exactly as the reviewer gave it.",
    schema,
  });
  if(value === undefined) return;
  assert.ok(value.rating >= 1 && value.rating <= 5, `rating ${value.rating} is outside 1..5`);
}
