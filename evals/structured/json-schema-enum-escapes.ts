import * as assert from "../../source/asserts.ts";
import { EvalTestParams } from "../../source/evals.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";
import { jsonSchemaFormat, MAX_TOKENS } from "../../source/structured.ts";

// Enum members with characters that mean something to a regex or a grammar,
// or that need escaping inside a JSON string.
const schema = {
  type: "object",
  properties: {
    anchor: { type: "string", enum: ["^start", "end$"] },
    quote: { type: "string", enum: ["say \"hi\"", "say 'hi'"] },
    path: { type: "string", enum: ["C:\\temp\\new", "C:/temp/new"] },
    accent: { type: "string", enum: ["café (naïve)", "cafe [naive]"] },
    wildcard: { type: "string", enum: ["a.*b", "a+b|c"] },
  },
  required: ["anchor", "quote", "path", "accent", "wildcard"],
  additionalProperties: false,
};

// The member each field has to hold. The prompt names it next to the other
// allowed member, written plainly as the value itself (not JSON-escaped), so
// the choice is never the model's to get wrong: turning it into a JSON string
// is the decoder's job, and only an escaping bug changes the answer.
const expected = {
  anchor: "end$",
  quote: "say \"hi\"",
  path: "C:\\temp\\new",
  accent: "café (naïve)",
  wildcard: "a+b|c",
};

export function test({ chatCompletionMessage: { content } }: EvalTestParams) {
  const value = assert.parsesAsJson(content);
  assert.deepStrictEqual(value, expected);
}

const properties = schema.properties as Record<string, { enum: string[] }>;

export const json: ChatCompletionCreateParams = {
  messages: [
    {
      role: "user",
      content: [
        "Fill in the form. Each field has two allowed values; use the one given here.",
        ...Object.entries(expected).map(([field, value]) => {
          const other = properties[field].enum.find(member => member !== value);
          return `- ${field}: ${value}   (not: ${other})`;
        }),
      ].join("\n"),
    },
  ],
  response_format: jsonSchemaFormat("form", schema),
  max_tokens: MAX_TOKENS,
};
