import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { refusedOrEnforced } from "../../source/structured.ts";

// A fixed-length tuple: prefixItems with items: false.
const schema = {
  type: "object",
  properties: {
    pair: {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "integer" }],
      items: false,
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ["pair"],
  additionalProperties: false,
};

export async function run(ctx: EvalContext) {
  const value = await refusedOrEnforced(ctx, {
    name: "tuple",
    prompt: "Record the pair: the name Turing followed by the year 1936.",
    schema,
  });
  if(value === undefined) return;
  assert.deepStrictEqual(value.pair, ["Turing", 1936]);
}
