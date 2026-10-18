import * as assert from "../../source/asserts.ts";
import { EvalContext } from "../../source/context.ts";
import { outputText } from "../../source/responses.ts";

// Codex runs stateless: store false, include reasoning.encrypted_content, and on the next turn it
// sends the whole previous output back as input, reasoning items included. The reasoning item has to
// come with its encrypted content, and the provider has to accept it back.
export async function run(ctx: EvalContext) {
  const question = { role: "user", content: "What is 17 times 23? Work it out carefully." };
  const first = await ctx.request("POST", "/responses", {
    model: ctx.model, max_output_tokens: 8192, store: false, include: ["reasoning.encrypted_content"],
    reasoning: { effort: "high", summary: "auto" }, input: [question],
  });
  ctx.supported(first, "store:false with include reasoning.encrypted_content");
  assert.status(first, 200);
  const items: any[] = first.json?.output ?? [];
  const reasoning = items.find((i) => i.type === "reasoning");
  assert.ok(reasoning, `Expected a reasoning item, got: ${items.map((i) => i.type).join(", ")}`);
  assert.ok(typeof reasoning.encrypted_content === "string" && reasoning.encrypted_content.length > 0,
    "Expected the reasoning item to carry encrypted_content when it was asked for");
  assert.stringContains(outputText(first.json), "391");

  const second = await ctx.request("POST", "/responses", {
    model: ctx.model, max_output_tokens: 8192, store: false, include: ["reasoning.encrypted_content"],
    reasoning: { effort: "high", summary: "auto" },
    input: [question, ...items, { role: "user", content: "Now add 9 to that. Reply with the number only." }],
  });
  assert.status(second, 200);
  assert.stringContains(outputText(second.json), "400");
}
