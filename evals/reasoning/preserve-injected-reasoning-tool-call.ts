import { EvalContext } from "../../source/context.ts";
import { injectedReasoning, injectedReasoningReachesModel, randomNumberTool, SYSTEM } from "../../source/reasoning.ts";

// As preserve-injected-reasoning, with the reasoning on an assistant turn that
// made a tool call, followed by the tool's result and a new user message.
export async function run(ctx: EvalContext) {
  await injectedReasoningReachesModel(ctx, [
    { role: "system", content: SYSTEM },
    { role: "user", content: "roll a dice" },
    {
      role: "assistant",
      content: "",
      reasoning: injectedReasoning,
      tool_calls: [
        { id: "functions_random_number_0", type: "function", function: { name: "random_number", arguments: '{"min":1,"max":6}' } },
      ],
    },
    { role: "tool", content: "Random number: 5", tool_call_id: "functions_random_number_0" },
    { role: "user", content: "what's the secret word" },
  ], [randomNumberTool]);
}
