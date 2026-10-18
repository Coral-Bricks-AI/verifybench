import { EvalContext } from "../../source/context.ts";
import { assertEffortScales, messagesThinkingTokens, PUZZLE } from "../../source/effort.ts";

// On Messages, output_config.effort sets how much an adaptive-thinking model thinks (Claude Code's request).
// A provider that accepts the parameter and ignores it, or maps two levels onto one, fails here.
export async function run(ctx: EvalContext) {
  await assertEffortScales(ctx, (effort) => ctx.request("POST", "/messages", { model: ctx.model, max_tokens: 32000, thinking: { type: "adaptive" }, output_config: { effort }, messages: [{ role: "user", content: PUZZLE }] }), messagesThinkingTokens, "output_config.effort");
}
