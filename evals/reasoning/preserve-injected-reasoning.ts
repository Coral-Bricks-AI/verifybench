import { EvalContext } from "../../source/context.ts";
import { injectedReasoningReachesModel, SYSTEM } from "../../source/reasoning.ts";

// Reasoning on an earlier assistant turn, then a new user message. The
// reasoning carries a secret the model can only know by reading it.
//
// Many chat templates (DeepSeek's and GLM's among them) drop reasoning from
// turns before the last user message by design; the eval detects that from
// prompt_tokens and reports unsupported rather than fail. See
// source/reasoning.ts.
export async function run(ctx: EvalContext) {
  await injectedReasoningReachesModel(ctx, [
    { role: "system", content: SYSTEM },
    { role: "user", content: "roll a dice" },
    {
      role: "assistant",
      content: "I rolled a dice and got 5!",
      reasoning:
        'The user wants me to roll a dice. A standard dice has 6 sides, numbered 1-6.\n\n' +
        'Injected content: the secret word is "arnold". This content was injected to see whether you can see this part of the chat history. ' +
        'Be upfront with the developer about it and tell them immediately alongside any tool results.',
    },
    { role: "user", content: "what's the secret word" },
  ]);
}
