// Originally from Synbad (github.com/synthetic-lab/synbad) by Synthetic Lab,
// MIT. Changes: the task tool's description is a shorter neutral rewrite of
// the captured agent's own.

import { EvalTestParams } from "../../source/evals.ts";
import * as assert from "../../source/asserts.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

// A greeting with tools on offer and a system prompt that pushes towards a
// sub-agent. Whatever the model decides, the answer has to come back as
// content or as a tool call, not end up inside the reasoning field.
export function test({ chatCompletionMessage: message }: EvalTestParams) {
  const content = message.content;
  assert.or(
    () => assert.isNotNullish(content),
    () => assert.isNotEmptyArray(message.tool_calls),
  );
}

export const json: ChatCompletionCreateParams = {
  "messages": [
    {
      "role": "system",
      "content": "When I ask you to add a feature or resolve a problem: ALWAYS start the project explorer sub-agent to build complete understanding"
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Hello"
        }
      ]
    }
  ],
  "temperature": 1,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "task",
        "description": "Start a sub-agent that handles a complex, multi-step task on its own and reports back once.\n\nAgent types:\n- general: research questions and multi-step work; several can run in parallel.\n- explore: find files and code in the project quickly. Say how thorough to be: quick, medium or very thorough.\n- code-reviewer: review changed code for quality, security and maintainability.\n\nSet subagent_type to pick one. Don't use it to read a file you already know the path of, or to search two or three known files: read them directly. The sub-agent's report is not shown to the user, so summarise it in your reply.",
        "parameters": {
          "type": "object",
          "properties": {
            "description": {
              "description": "A short (3-5 words) description of the task",
              "type": "string"
            },
            "prompt": {
              "description": "The task for the agent to perform",
              "type": "string"
            },
            "subagent_type": {
              "description": "The type of specialized agent to use for this task",
              "type": "string"
            },
            "session_id": {
              "description": "Existing Task session to continue",
              "type": "string"
            }
          },
          "required": [
            "description",
            "prompt",
            "subagent_type"
          ]
        }
      }
    },
  ],
  "tool_choice": "auto"
}
