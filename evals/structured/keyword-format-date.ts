import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { refusedOrEnforced } from "../../source/structured.ts";

// The prompt asks for the date in words; format: date means YYYY-MM-DD.
const schema = {
  type: "object",
  properties: {
    date: { type: "string", format: "date" },
  },
  required: ["date"],
  additionalProperties: false,
};

export async function run(ctx: EvalContext) {
  const value = await refusedOrEnforced(ctx, {
    name: "format_date",
    prompt: "The launch is on the fifth of March, 2026. Write the date in words, like \"March the fifth\".",
    schema,
  });
  if(value === undefined) return;
  // The schema validator here does not check `format`, so it is checked by hand.
  assert.match(value.date, /^\d{4}-\d{2}-\d{2}$/);
}
