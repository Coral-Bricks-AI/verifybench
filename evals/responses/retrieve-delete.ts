import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

export async function run(ctx: EvalContext) {
  const created = await ctx.responses({ input: "Reply with the single word: pong" });
  assert.status(created.raw, 200);
  const id = created.response.id;

  const fetched = await ctx.request("GET", `/responses/${id}`);
  ctx.supported(fetched, "GET /responses/{id}");
  assert.status(fetched, 200);
  assert.strictEqual(fetched.json.id, id);
  assert.strictEqual(fetched.json.status, "completed");
  assert.strictEqual(outputText(fetched.json), outputText(created.response));

  const deleted = await ctx.request("DELETE", `/responses/${id}`);
  ctx.supported(deleted, "DELETE /responses/{id}");
  assert.status(deleted, 200);
  assert.strictEqual(deleted.json.deleted, true);

  const gone = await ctx.request("GET", `/responses/${id}`);
  assert.status(gone, 404);
}
