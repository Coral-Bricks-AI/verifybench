import * as assert from "../../source/asserts.ts";
import { getReasoning } from "../../source/chat-completion.ts";
import { EvalContext } from "../../source/context.ts";

// `stop` applies to the visible content, not to reasoning. A reasoning model
// that writes the list out while it thinks would otherwise be cut off before
// it says anything, which is what callers of `stop` never want: they use it to
// end the answer, e.g. at the start of a turn marker.
export async function run(ctx: EvalContext) {
  const { chatCompletionMessage: message, finishReason } = await ctx.chat({
    messages: [
      { role: "user", content: "Print the words alpha, bravo, charlie, delta, echo, one per line, and nothing else." },
    ],
    stop: ["delta"],
  });

  const text = String(message.content ?? "");
  const reasoning = String(getReasoning(message) ?? "");
  if(!text.includes("charlie") && reasoning.length > 0 && !/delta/.test(reasoning) && /charlie|bravo|alpha/.test(reasoning)) {
    assert.fail(`the stop sequence ended the reply inside the reasoning (content ${JSON.stringify(text.slice(0, 80))}); it must apply to the content only`);
  }
  assert.stringContains(text, "charlie");
  // The stop sequence itself is never returned, and nothing after it is.
  assert.doesNotMatch(text, /delta|echo/);
  assert.strictEqual(finishReason, "stop");
}
