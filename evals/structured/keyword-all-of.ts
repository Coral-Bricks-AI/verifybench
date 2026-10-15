import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { refusedOrEnforced } from "../../source/structured.ts";

// allOf has to be merged into one object before a grammar can be built.
const schema = {
  allOf: [
    {
      type: "object",
      properties: { id: { type: "integer" } },
      required: ["id"],
    },
    {
      type: "object",
      properties: { email: { type: "string" } },
      required: ["email"],
    },
  ],
};

export async function run(ctx: EvalContext) {
  const value = await refusedOrEnforced(ctx, {
    name: "all_of",
    prompt: "Record the user with id 7 and the address ada@example.com.",
    schema,
  });
  if(value === undefined) return;
  assert.strictEqual(value.id, 7);
  assert.strictEqual(value.email, "ada@example.com");
}
