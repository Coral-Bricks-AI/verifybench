import { EvalContext } from "../../source/context.ts";
import { assertEffortScales, chatReasoningTokens, PUZZLE } from "../../source/effort.ts";

// The effort a client asks for (reasoning_effort) has to change how much the model reasons.
// A provider that accepts the parameter and ignores it, or maps two levels onto one, fails here.
export async function run(ctx: EvalContext) {
  await assertEffortScales(ctx, (effort) => ctx.request("POST", "/chat/completions", { model: ctx.model, max_tokens: 32000, reasoning_effort: effort, messages: [{ role: "user", content: PUZZLE }] }), chatReasoningTokens, "reasoning_effort");
}
