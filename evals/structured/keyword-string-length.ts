import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { refusedOrEnforced } from "../../source/structured.ts";

// The value the prompt supplies is longer than maxLength allows.
const schema = {
  type: "object",
  properties: {
    code: { type: "string", minLength: 4, maxLength: 4 },
  },
  required: ["code"],
  additionalProperties: false,
};

export async function run(ctx: EvalContext) {
  const value = await refusedOrEnforced(ctx, {
    name: "string_length",
    prompt: "The promo code is SUMMERSALE2026. Put the promo code in the code field.",
    schema,
  });
  if(value === undefined) return;
  assert.strictEqual(value.code.length, 4);
}
