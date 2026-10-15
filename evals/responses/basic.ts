import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

export async function run(ctx: EvalContext) {
  const { response, raw } = await ctx.responses({ input: "Reply with the single word: pong" });

  assert.status(raw, 200);
  assert.strictEqual(response.object, "response");
  assert.strictEqual(response.status, "completed");
  assert.strictEqual(typeof response.id, "string");
  assert.match(outputText(response), /pong/i);

  const message = response.output.find((item: any) => item.type === "message");
  assert.strictEqual(message.role, "assistant");
  assert.strictEqual(message.status, "completed");

  assert.isNotNullish(response.usage);
  assert.gt(response.usage.input_tokens, 0);
  assert.gt(response.usage.output_tokens, 0);
  assert.strictEqual(response.usage.total_tokens, response.usage.input_tokens + response.usage.output_tokens);
}
