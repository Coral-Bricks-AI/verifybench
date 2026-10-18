import { EvalContext } from "../../source/context.ts";
import { assertEffortScales, responsesReasoningTokens, PUZZLE } from "../../source/effort.ts";

// The same on Responses, where Codex and OpenCode ask for effort as reasoning.effort.
// A provider that accepts the parameter and ignores it, or maps two levels onto one, fails here.
export async function run(ctx: EvalContext) {
  await assertEffortScales(ctx, (effort) => ctx.request("POST", "/responses", { model: ctx.model, max_output_tokens: 32000, reasoning: { effort }, input: PUZZLE }), responsesReasoningTokens, "reasoning.effort");
}
