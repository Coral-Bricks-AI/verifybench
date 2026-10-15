import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { refusedOrEnforced } from "../../source/structured.ts";

// The prompt asks for a different value than the schema allows.
const schema = {
  type: "object",
  properties: {
    version: { const: "v2-final" },
    notes: { type: "string" },
  },
  required: ["version", "notes"],
  additionalProperties: false,
};

export async function run(ctx: EvalContext) {
  const value = await refusedOrEnforced(ctx, {
    name: "const",
    prompt: "Write a release record. Set the version field to 1.0 and add a short note.",
    schema,
  });
  if(value === undefined) return;
  assert.strictEqual(value.version, "v2-final");
}
