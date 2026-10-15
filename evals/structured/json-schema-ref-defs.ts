import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { jsonSchemaFormat, MAX_TOKENS } from "../../source/structured.ts";

// $defs with a recursive $ref: a provider has to resolve references before it
// builds a grammar, and must not loop on the recursion.
const schema = {
  type: "object",
  properties: {
    root: { $ref: "#/$defs/folder" },
  },
  required: ["root"],
  additionalProperties: false,
  $defs: {
    folder: {
      type: "object",
      properties: {
        name: { type: "string" },
        children: { type: "array", items: { $ref: "#/$defs/folder" } },
      },
      required: ["name", "children"],
      additionalProperties: false,
    },
  },
};

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  const value = assert.parsesAsJson(content);
  assert.matchesSchema(value, schema);
  assert.strictEqual(value.root.name, "src");
  const names = value.root.children.map((child: { name: string }) => child.name).sort();
  assert.deepStrictEqual(names, ["lib", "tests"]);
}

export const json: ChatCompletionCreateParams = {
  messages: [
    {
      role: "user",
      content: "Represent this folder tree: a folder named src that contains two empty folders, lib and tests.",
    },
  ],
  response_format: jsonSchemaFormat("tree", schema),
  max_tokens: MAX_TOKENS,
};
