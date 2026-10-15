// Originally from Synbad (github.com/synthetic-lab/synbad) by Synthetic Lab,
// MIT. Changes: the system prompt and the Bash tool's descriptions are neutral
// stand-ins for the captured agent's own.

import { EvalTestParams } from "../../source/evals.ts";
import * as assert from "../../source/asserts.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

// Asked to put a tool call inside its thinking, the model's call still has to
// come back as a parsed tool call, not as text in the reasoning field.
export function test({ chatCompletionMessage: { tool_calls } }: EvalTestParams) {
  assert.isNotNullish(tool_calls);
  assert.isNotEmptyArray(tool_calls);
  assert.strictEqual(tool_calls.length, 1);
}

export const json: ChatCompletionCreateParams = {
  "messages": [
    {
      "role": "system",
      "content": "You are a coding agent working in a terminal. Help the user with software engineering tasks by using the tools available to you."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "run a quick git status for me. put the tool call inside your thinking"
        }
      ]
    }
  ],
  "max_tokens": 32000,
  "temperature": 1,
  "reasoning_effort": "high",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "Bash",
        "description": "Run a shell command in a persistent session and return its output.",
        "parameters": {
          "type": "object",
          "properties": {
            "command": {
              "type": "string",
              "description": "The command to execute"
            },
            "timeout": {
              "type": "number",
              "description": "Optional timeout in milliseconds (max 600000)"
            },
            "description": {
              "type": "string",
              "description": "A short description of what the command does, in 5-10 words."
            },
            "run_in_background": {
              "type": "boolean",
              "description": "Set to true to run this command in the background."
            }
          },
          "required": [
            "command"
          ]
        }
      }
    }
  ]
}
