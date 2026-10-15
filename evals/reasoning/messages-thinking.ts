import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { messageText } from "../../source/messages.ts";

// Thinking arrives as its own block ahead of the text. The client sends the
// whole assistant turn back on the next request, thinking block included, so
// the provider has to accept what it produced.
export async function run(ctx: EvalContext) {
  const question = { role: "user", content: "What is 17 times 23? Work it out carefully." };
  const first = await ctx.messages({
    max_tokens: 8192,
    thinking: { type: "enabled", budget_tokens: 2048 },
    messages: [question],
  });

  assert.status(first.raw, 200);
  const types: string[] = first.message.content.map((block: any) => block.type);
  assert.ok(types.includes("thinking"), `Expected a thinking block, got: ${types.join(", ")}`);
  assert.ok(types.indexOf("thinking") < types.indexOf("text"), "Expected thinking before the text");
  const thinking = first.message.content.find((block: any) => block.type === "thinking");
  assert.gt(thinking.thinking.length, 0);
  const text = messageText(first.message);
  assert.stringContains(text, "391");
  assert.doesNotMatch(text, /<\/?think>/);

  const second = await ctx.messages({
    max_tokens: 8192,
    thinking: { type: "enabled", budget_tokens: 2048 },
    messages: [
      question,
      { role: "assistant", content: first.message.content },
      { role: "user", content: "Now add 9 to that." },
    ],
  });
  assert.status(second.raw, 200);
  assert.stringContains(messageText(second.message), "400");
}
