import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

const schema = {
  type: "object",
  properties: {
    ticket: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$" },
    urgent: { type: "boolean" },
  },
  required: ["ticket", "urgent"],
  additionalProperties: false,
};

// Structured output on Responses lives under text.format, with the schema
// fields one level up from where Chat Completions puts them.
export async function run(ctx: EvalContext) {
  const { response, raw } = await ctx.responses({
    input: "The customer wrote in about ticket QRX-4821 and says it can wait until next week.",
    text: { format: { type: "json_schema", name: "ticket", strict: true, schema } },
  });

  assert.status(raw, 200);
  const value = assert.parsesAsJson(outputText(response));
  assert.matchesSchema(value, schema);
  assert.deepStrictEqual(value, { ticket: "QRX-4821", urgent: false });
}
