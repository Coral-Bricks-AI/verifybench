// Originally from Synbad (github.com/synthetic-lab/synbad) by Synthetic Lab,
// MIT. Changes: the system prompt, the tool descriptions, the todo reminder
// and the tool-result text are short neutral stand-ins for the captured
// agent's own; tool names, parameter schemas and the conversation shape are
// unchanged.

import { EvalTestParams } from "../../source/evals.ts";
import * as assert from "../../source/asserts.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

// A coding-agent loop, one step in: the assistant turn carries content parts,
// reasoning_content and a tool call whose id is namespaced the way some
// engines write it ("functions.Name:0-..."), followed by the tool's result.
// The model has to carry on with another tool call, parsed as one.
//
// The system prompt and tool descriptions are short stand-ins written for this
// eval; the original capture used a production agent's full prompt.
export function test({ chatCompletionMessage: { tool_calls } }: EvalTestParams) {
  assert.isNotNullish(tool_calls);
  assert.isNotEmptyArray(tool_calls);
}

export const json: ChatCompletionCreateParams = {
  "messages": [
    {
      "role": "system",
      "content": "You are a coding agent working in a terminal. Help the user with software engineering tasks by using the tools available to you.\n\n- Plan any task with more than one step with TodoWrite, and keep the list up to date as you work.\n- Read, search and edit files with the file tools; keep the shell for commands that need it.\n- Keep replies short. Do not create files the task does not need.\n\nWorking directory: /home/user/series-a-dash\nPlatform: linux"
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Reminder: the todo list is currently empty. Use TodoWrite if the task has several steps."
        },
        {
          "type": "text",
          "text": "make me a finance dashboard for my series a startup that sells paperclips, using tailwind 3 and typescript. you can mock all the data"
        }
      ]
    },
    {
      "role": "assistant",
      "reasoning_content": "The user wants a finance dashboard for their Series A startup that sells paperclips. They want:\n1. Built with Tailwind CSS v3\n2. TypeScript\n3. Use mock data\n4. Focus on financial metrics\n\nThis is a single task, but it's multi-step (need to create files, structure the app, add components, mock data, etc.). I should use TodoWrite to plan this out since it has multiple distinct steps and requires creating multiple files.\n\nLet me plan the structure:\n1. Set up the project structure\n2. Create mock data for a paperclip startup\n3. Build key financial dashboard components\n4. Create the main dashboard page\n\nThis warrants a todo list. Let me create one.",
      "tool_calls": [
        {
          "id": "functions.TodoWrite:0-67aa36ac-ee4d-4d8f-97fa-346a9b15992d",
          "type": "function",
          "function": {
            "name": "TodoWrite",
            "arguments": "{\"todos\":[{\"content\":\"Set up project structure and dependencies\",\"status\":\"in_progress\",\"activeForm\":\"Setting up project structure and dependencies\"},{\"content\":\"Create TypeScript types and mock financial data\",\"status\":\"pending\",\"activeForm\":\"Creating TypeScript types and mock financial data\"},{\"content\":\"Build core dashboard components (KPI cards, charts, tables)\",\"status\":\"pending\",\"activeForm\":\"Building core dashboard components\"},{\"content\":\"Create main dashboard page with Tailwind styling\",\"status\":\"pending\",\"activeForm\":\"Creating main dashboard page with Tailwind styling\"}]}"
          }
        }
      ],
      "content": [
        {
          "type": "text",
          "text": " I'll create a finance dashboard for your paperclip startup! Let me plan this out and then build it for you."
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "functions.TodoWrite:0-67aa36ac-ee4d-4d8f-97fa-346a9b15992d",
      "content": "Todo list updated: 4 items, 1 in progress. Carry on with the item in progress."
    }
  ],
  "max_tokens": 32000,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "Task",
        "description": "Start a sub-agent that works on a multi-step task by itself and reports back once.",
        "parameters": {
          "type": "object",
          "properties": {
            "description": {
              "type": "string",
              "description": "A short (3-5 word) description of the task"
            },
            "prompt": {
              "type": "string",
              "description": "The task for the agent to perform"
            },
            "subagent_type": {
              "type": "string",
              "description": "The type of specialized agent to use for this task"
            },
            "model": {
              "type": "string",
              "enum": [
                "small",
                "medium",
                "large"
              ],
              "description": "Optional model size for the sub-agent."
            },
            "resume": {
              "type": "string",
              "description": "Optional agent ID to resume from."
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
    {
      "type": "function",
      "function": {
        "name": "Bash",
        "description": "Run a shell command and return its output. Use it for builds, package managers, git and other terminal work; use the file tools to read, search and edit files.",
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
            },
            "dangerouslyDisableSandbox": {
              "type": "boolean",
              "description": "Set this to true to dangerously override sandbox mode and run commands without sandboxing."
            }
          },
          "required": [
            "command"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "Glob",
        "description": "Find files whose path matches a glob pattern.",
        "parameters": {
          "type": "object",
          "properties": {
            "pattern": {
              "type": "string",
              "description": "The glob pattern to match files against"
            },
            "path": {
              "type": "string",
              "description": "The directory to search in."
            }
          },
          "required": [
            "pattern"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "Grep",
        "description": "Search file contents with a regular expression.",
        "parameters": {
          "type": "object",
          "properties": {
            "pattern": {
              "type": "string",
              "description": "The regular expression pattern to search for in file contents"
            },
            "path": {
              "type": "string",
              "description": "File or directory to search in."
            },
            "glob": {
              "type": "string",
              "description": "Glob pattern to filter files, e.g. *.ts"
            },
            "output_mode": {
              "type": "string",
              "enum": [
                "content",
                "files_with_matches",
                "count"
              ],
              "description": "content (matching lines), files_with_matches (file paths) or count. Defaults to files_with_matches."
            },
            "-B": {
              "type": "number",
              "description": "Number of lines to show before each match."
            },
            "-A": {
              "type": "number",
              "description": "Number of lines to show after each match."
            },
            "-C": {
              "type": "number",
              "description": "Number of lines to show before and after each match."
            },
            "-n": {
              "type": "boolean",
              "description": "Show line numbers in output."
            },
            "-i": {
              "type": "boolean",
              "description": "Case insensitive search"
            },
            "type": {
              "type": "string",
              "description": "File type to search."
            },
            "head_limit": {
              "type": "number",
              "description": "Limit output to first N lines/entries, equivalent to \"| head -N\"."
            },
            "offset": {
              "type": "number",
              "description": "Skip first N lines/entries before applying head_limit, equivalent to \"| tail -n +N | head -N\"."
            },
            "multiline": {
              "type": "boolean",
              "description": "Let patterns span lines."
            }
          },
          "required": [
            "pattern"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "ExitPlanMode",
        "description": "Present a plan to the user for approval before making changes.",
        "parameters": {
          "type": "object",
          "properties": {
            "plan": {
              "type": "string",
              "description": "The plan you came up with, that you want to run by the user for approval."
            }
          },
          "required": [
            "plan"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "Read",
        "description": "Read a file from the local filesystem.",
        "parameters": {
          "type": "object",
          "properties": {
            "file_path": {
              "type": "string",
              "description": "The absolute path to the file to read"
            },
            "offset": {
              "type": "number",
              "description": "The line number to start reading from."
            },
            "limit": {
              "type": "number",
              "description": "The number of lines to read."
            }
          },
          "required": [
            "file_path"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "Edit",
        "description": "Replace an exact string in a file.",
        "parameters": {
          "type": "object",
          "properties": {
            "file_path": {
              "type": "string",
              "description": "The absolute path to the file to modify"
            },
            "old_string": {
              "type": "string",
              "description": "The text to replace"
            },
            "new_string": {
              "type": "string",
              "description": "The text to replace it with (must be different from old_string)"
            },
            "replace_all": {
              "type": "boolean",
              "default": false,
              "description": "Replace all occurences of old_string (default false)"
            }
          },
          "required": [
            "file_path",
            "old_string",
            "new_string"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "Write",
        "description": "Write a file to the local filesystem, replacing any existing file.",
        "parameters": {
          "type": "object",
          "properties": {
            "file_path": {
              "type": "string",
              "description": "The absolute path to the file to write (must be absolute, not relative)"
            },
            "content": {
              "type": "string",
              "description": "The content to write to the file"
            }
          },
          "required": [
            "file_path",
            "content"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "NotebookEdit",
        "description": "Replace, insert or delete a cell in a Jupyter notebook.",
        "parameters": {
          "type": "object",
          "properties": {
            "notebook_path": {
              "type": "string",
              "description": "The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)"
            },
            "cell_id": {
              "type": "string",
              "description": "The ID of the cell to edit."
            },
            "new_source": {
              "type": "string",
              "description": "The new source for the cell"
            },
            "cell_type": {
              "type": "string",
              "enum": [
                "code",
                "markdown"
              ],
              "description": "The type of the cell (code or markdown)."
            },
            "edit_mode": {
              "type": "string",
              "enum": [
                "replace",
                "insert",
                "delete"
              ],
              "description": "The type of edit to make (replace, insert, delete)."
            }
          },
          "required": [
            "notebook_path",
            "new_source"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "WebFetch",
        "description": "Fetch a URL and answer a prompt about its content.",
        "parameters": {
          "type": "object",
          "properties": {
            "url": {
              "type": "string",
              "format": "uri",
              "description": "The URL to fetch content from"
            },
            "prompt": {
              "type": "string",
              "description": "The prompt to run on the fetched content"
            }
          },
          "required": [
            "url",
            "prompt"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "TodoWrite",
        "description": "Create and update a structured todo list for the current task. Use it for multi-step work, keep exactly one item in progress, and mark items completed as soon as they are done.",
        "parameters": {
          "type": "object",
          "properties": {
            "todos": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "content": {
                    "type": "string",
                    "minLength": 1
                  },
                  "status": {
                    "type": "string",
                    "enum": [
                      "pending",
                      "in_progress",
                      "completed"
                    ]
                  },
                  "activeForm": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "content",
                  "status",
                  "activeForm"
                ],
                "additionalProperties": false
              },
              "description": "The updated todo list"
            }
          },
          "required": [
            "todos"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "WebSearch",
        "description": "Search the web and return result snippets.",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "minLength": 2,
              "description": "The search query to use"
            },
            "allowed_domains": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "Only include search results from these domains"
            },
            "blocked_domains": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "Never include search results from these domains"
            }
          },
          "required": [
            "query"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "BashOutput",
        "description": "Read new output from a background shell.",
        "parameters": {
          "type": "object",
          "properties": {
            "bash_id": {
              "type": "string",
              "description": "The ID of the background shell to retrieve output from"
            },
            "filter": {
              "type": "string",
              "description": "Optional regular expression to filter the output lines."
            }
          },
          "required": [
            "bash_id"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "KillShell",
        "description": "Stop a background shell.",
        "parameters": {
          "type": "object",
          "properties": {
            "shell_id": {
              "type": "string",
              "description": "The ID of the background shell to kill"
            }
          },
          "required": [
            "shell_id"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "AskUserQuestion",
        "description": "Ask the user one to four multiple-choice questions.",
        "parameters": {
          "type": "object",
          "properties": {
            "questions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "question": {
                    "type": "string",
                    "description": "The complete question to ask the user."
                  },
                  "header": {
                    "type": "string",
                    "description": "Very short label displayed as a chip/tag (max 12 chars)."
                  },
                  "options": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "label": {
                          "type": "string",
                          "description": "The display text for this option that the user will see and select."
                        },
                        "description": {
                          "type": "string",
                          "description": "Explanation of what this option means or what will happen if chosen."
                        }
                      },
                      "required": [
                        "label",
                        "description"
                      ],
                      "additionalProperties": false
                    },
                    "minItems": 2,
                    "maxItems": 4,
                    "description": "The available choices for this question."
                  },
                  "multiSelect": {
                    "type": "boolean",
                    "description": "Set to true to allow the user to select multiple options instead of just one."
                  }
                },
                "required": [
                  "question",
                  "header",
                  "options",
                  "multiSelect"
                ],
                "additionalProperties": false
              },
              "minItems": 1,
              "maxItems": 4,
              "description": "Questions to ask the user (1-4 questions)"
            },
            "answers": {
              "type": "object",
              "additionalProperties": {
                "type": "string"
              },
              "description": "User answers collected by the permission component"
            }
          },
          "required": [
            "questions"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "Skill",
        "description": "Run a named skill.",
        "parameters": {
          "type": "object",
          "properties": {
            "skill": {
              "type": "string",
              "description": "The skill name (no arguments)."
            }
          },
          "required": [
            "skill"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "SlashCommand",
        "description": "Run a slash command.",
        "parameters": {
          "type": "object",
          "properties": {
            "command": {
              "type": "string",
              "description": "The slash command to execute with its arguments, e.g., \"/review-pr 123\""
            }
          },
          "required": [
            "command"
          ]
        }
      }
    }
  ]
};
