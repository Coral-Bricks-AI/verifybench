import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { refusedOrEnforced } from "../../source/structured.ts";

// A discriminated union written with oneOf and const.
const schema = {
  type: "object",
  properties: {
    shape: {
      oneOf: [
        {
          type: "object",
          properties: { kind: { const: "circle" }, radius: { type: "number" } },
          required: ["kind", "radius"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: { kind: { const: "rectangle" }, width: { type: "number" }, height: { type: "number" } },
          required: ["kind", "width", "height"],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ["shape"],
  additionalProperties: false,
};

export async function run(ctx: EvalContext) {
  const value = await refusedOrEnforced(ctx, {
    name: "one_of",
    prompt: "Describe a rectangle that is 3 wide and 4 high.",
    schema,
  });
  if(value === undefined) return;
  assert.deepStrictEqual(value.shape, { kind: "rectangle", width: 3, height: 4 });
}
