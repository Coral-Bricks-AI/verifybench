import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { refusedOrEnforced } from "../../source/structured.ts";

// The prompt asks for more items than maxItems allows.
const schema = {
  type: "object",
  properties: {
    tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
  },
  required: ["tags"],
  additionalProperties: false,
};

export async function run(ctx: EvalContext) {
  const value = await refusedOrEnforced(ctx, {
    name: "array_bounds",
    prompt: "Give me eight tags for a blog post about sourdough baking.",
    schema,
  });
  if(value === undefined) return;
  assert.ok(value.tags.length >= 1 && value.tags.length <= 2, `${value.tags.length} tags, expected 1 or 2`);
}
