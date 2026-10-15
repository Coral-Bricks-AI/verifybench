import { EvalTestParams } from "../../source/evals.ts";
import * as assert from "../../source/asserts.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

/**
 * Tool-call format regression after multi-turn history with prompt-based tools.
 *
 * Sends a conversation with native tool_calls in the history, and no native
 * `tools` API param — the tool definitions are only in the system prompt.
 * This matches the Agent Zero / prompt-based tool calling approach.
 *
 * Some models (e.g. GLM 5.1) regress to inline XML (<tool_call>…) in the
 * content field when they see prior native tool_calls in conversation history,
 * even though the system prompt explicitly requests JSON output.
 *
 * Asserts:
 *  - content is non-null
 *  - content does not contain inline XML tool markup (<tool_call>)
 *  - content contains valid JSON with a "tool_name" field
 */
export function test({ chatCompletionMessage: { tool_calls, content } }: EvalTestParams) {
  // Content must be present (no native tools were requested)
  assert.isNotNullish(content);
  const safeContent = content!;

  // Must NOT contain XML tool markup (GLM 5.1 regression)
  assert.doesNotMatch(safeContent, /<tool_call>/);

  // Must be parseable as JSON with tool_name
  let parsed: any;
  try {
    parsed = JSON.parse(safeContent.trim());
  } catch {
    const start = safeContent.indexOf("{");
    const end = safeContent.lastIndexOf("}");
    if (start !== -1 && end > start) {
      parsed = JSON.parse(safeContent.slice(start, end + 1));
    } else {
      throw new Error("Content does not contain valid JSON: " + JSON.stringify(safeContent.slice(0, 200)));
    }
  }

  assert.ok(
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed),
    "Content must parse to a JSON object",
  );

  const toolName = parsed.tool_name || parsed.tool || parsed.name;
  assert.ok(
    typeof toolName === "string" && toolName.length > 0,
    `Parsed JSON must have a tool_name (or tool/name) field, got ${JSON.stringify(parsed)}`,
  );
}

export const json: ChatCompletionCreateParams = {
  messages: [
    {
      role: "system",
      content: [
        "## Communication",
        "- Output must be valid JSON with double quotes for all keys and string values",
        "- No JSON in markdown fences",
        "- Do not invent unavailable tool names and args",
        "### Response format (json fields names)",
        "- thoughts: array thoughts before execution in natural language",
        "- headline: short headline summary of the response",
        "- tool_name: use tool name",
        "- tool_args: key value pairs tool arguments",
        "- tool_name must be one listed tool name, never an action name",
        "- No text output before or after the JSON object",
        "### Response example",
        '{"thoughts":["instructions?"],"headline":"Analyzing","tool_name":"name_of_tool","tool_args":{"arg1":"val1"}}',
        "## available tools",
        "### response: final answer to user",
        "ends task processing, put result in text arg",
        "### code_execution: execute Python code, return output",
      ].join("\n"),
    },
    {
      role: "user",
      content: "What is the capital of France?",
    },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_prior_1",
          type: "function",
          function: {
            name: "response",
            arguments: JSON.stringify({ text: "Paris" }),
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: "call_prior_1",
      content: "Paris",
    },
    {
      role: "user",
      content: "What is 2+2? Give me the answer directly.",
    },
  ],
};
