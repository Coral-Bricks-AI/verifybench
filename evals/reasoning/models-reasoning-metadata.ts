import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { modelRow } from "../../source/effort.ts";

// A harness can only offer the right effort levels if the provider says what they are. Without that,
// every harness needs a hand-written catalog (Codex's model_catalog_json, per-model variants elsewhere).
// Accepted forms: supported_parameters naming reasoning (OpenRouter's), or a reasoning object listing
// the efforts (supported_efforts / efforts / levels).
export async function run(ctx: EvalContext) {
  const raw = await ctx.request("GET", "/models");
  ctx.supported(raw, "GET /models");
  assert.status(raw, 200);
  const row = await modelRow(ctx);
  assert.ok(row, `GET /models does not list ${ctx.model}`);
  const params: string[] = row.supported_parameters ?? [];
  const efforts = row.reasoning?.supported_efforts ?? row.reasoning?.efforts ?? row.reasoning?.levels ?? row.reasoning_efforts;
  const says = params.some((p) => /^reasoning/.test(p)) || (Array.isArray(efforts) && efforts.length > 0) || row.supports_reasoning === false;
  assert.ok(says, `${ctx.model}'s row on GET /models does not say whether it reasons or which efforts it takes`);
}
