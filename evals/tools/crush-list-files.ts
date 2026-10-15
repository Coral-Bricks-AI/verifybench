// Originally from Synbad (github.com/synthetic-lab/synbad) by Synthetic Lab,
// MIT. Changes: the system prompt and tool descriptions are short neutral
// stand-ins for the captured agent's own, and the working directory is
// /home/user/scratch-scripts; tool names, parameter schemas and the assertions
// are unchanged.

import { EvalTestParams } from "../../source/evals.ts";
import * as assert from "../../source/asserts.ts";
import { ChatCompletionCreateParams } from "../../source/chat-completion.ts";

// A coding agent's first step in an unknown folder: asked to look around, the
// model should list the directory, with the ls tool or with ls/find in bash,
// and the call has to come back parsed.
//
// The system prompt and tool descriptions are short stand-ins written for this
// eval; the original capture used a production agent's full prompt.
export function test({ chatCompletionMessage: { tool_calls } }: EvalTestParams) {
  assert.isNotNullish(tool_calls);
  assert.isNotEmptyArray(tool_calls);
  assert.gte(tool_calls.length, 1);
  assert.strictEqual(tool_calls[0].type, "function");
  const fn = tool_calls[0].function;
  assert.or(
    () => {
      assert.strictEqual(fn.name, "ls");
      if(fn.arguments) {
        const args = JSON.parse(fn.arguments);
        assert.or(
          () => assert.strictEqual(args.path, "/home/user/scratch-scripts"),
          () => assert.strictEqual(args.path, "."),
          () => assert.isNullish(args.path),
        );
      }
    },
    () => {
      assert.strictEqual(fn.name, "bash");
      const args = JSON.parse(fn.arguments);
      assert.or(
        () => assert.startsWith(args.command, "ls"),
        () => assert.startsWith(args.command, "find"),
      );
    },
  );
}

export const json: ChatCompletionCreateParams = {
  "messages": [
    {
      "content": "You are a coding assistant running in a terminal. Use the tools to explore and change the user's project.\n\n- Read a file before you edit it.\n- Prefer the file tools (ls, view, glob, grep) to shell commands for looking around.\n- Keep answers short and factual.\n\nWorking directory: /home/user/scratch-scripts\nIs directory a git repo: no\nPlatform: linux",
      "role": "system"
    },
    {
      "content": "read some files and tell me about this repo",
      "role": "user"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "description": "Start a sub-agent that searches the project for you and reports back.",
        "name": "agent",
        "parameters": {
          "properties": {
            "prompt": {
              "description": "The task for the agent to perform",
              "type": "string"
            }
          },
          "required": [
            "prompt"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Fetch a web page and answer a prompt about it.",
        "name": "agentic_fetch",
        "parameters": {
          "properties": {
            "prompt": {
              "description": "The prompt to run on the fetched content",
              "type": "string"
            },
            "url": {
              "description": "The URL to fetch content from",
              "type": "string"
            }
          },
          "required": [
            "url",
            "prompt"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Run a shell command and return its output.",
        "name": "bash",
        "parameters": {
          "properties": {
            "command": {
              "description": "The command to execute",
              "type": "string"
            },
            "description": {
              "description": "A brief description of what the command does, try to keep it under 30 characters or so",
              "type": "string"
            },
            "run_in_background": {
              "description": "Set to true (boolean) to run this command in the background.",
              "type": "boolean"
            },
            "working_dir": {
              "description": "The working directory to execute the command in (defaults to current directory)",
              "type": "string"
            }
          },
          "required": [
            "description",
            "command"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Download a URL to a local file.",
        "name": "download",
        "parameters": {
          "properties": {
            "file_path": {
              "description": "The local file path where the downloaded content should be saved",
              "type": "string"
            },
            "timeout": {
              "description": "Optional timeout in seconds (max 600)",
              "type": "integer"
            },
            "url": {
              "description": "The URL to download from",
              "type": "string"
            }
          },
          "required": [
            "url",
            "file_path"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Replace an exact string in a file.",
        "name": "edit",
        "parameters": {
          "properties": {
            "file_path": {
              "description": "The absolute path to the file to modify",
              "type": "string"
            },
            "new_string": {
              "description": "The text to replace it with",
              "type": "string"
            },
            "old_string": {
              "description": "The text to replace",
              "type": "string"
            },
            "replace_all": {
              "description": "Replace all occurrences of old_string (default false)",
              "type": "boolean"
            }
          },
          "required": [
            "file_path",
            "old_string",
            "new_string"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Fetch a URL and return its content as text, markdown or HTML.",
        "name": "fetch",
        "parameters": {
          "properties": {
            "format": {
              "description": "The format to return the content in (text, markdown, or html)",
              "type": "string"
            },
            "timeout": {
              "description": "Optional timeout in seconds (max 120)",
              "type": "integer"
            },
            "url": {
              "description": "The URL to fetch content from",
              "type": "string"
            }
          },
          "required": [
            "url",
            "format"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Find files whose path matches a glob pattern.",
        "name": "glob",
        "parameters": {
          "properties": {
            "path": {
              "description": "The directory to search in.",
              "type": "string"
            },
            "pattern": {
              "description": "The glob pattern to match files against",
              "type": "string"
            }
          },
          "required": [
            "pattern"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Search file contents with a regular expression.",
        "name": "grep",
        "parameters": {
          "properties": {
            "include": {
              "description": "File pattern to include in the search, e.g. *.js",
              "type": "string"
            },
            "literal_text": {
              "description": "If true, the pattern will be treated as literal text with special regex characters escaped.",
              "type": "boolean"
            },
            "path": {
              "description": "The directory to search in.",
              "type": "string"
            },
            "pattern": {
              "description": "The regex pattern to search for in file contents",
              "type": "string"
            }
          },
          "required": [
            "pattern"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Stop a background shell.",
        "name": "job_kill",
        "parameters": {
          "properties": {
            "shell_id": {
              "description": "The ID of the background shell to terminate",
              "type": "string"
            }
          },
          "required": [
            "shell_id"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Read the output of a background shell.",
        "name": "job_output",
        "parameters": {
          "properties": {
            "shell_id": {
              "description": "The ID of the background shell to retrieve output from",
              "type": "string"
            }
          },
          "required": [
            "shell_id"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "List the files and folders in a directory as a tree.",
        "name": "ls",
        "parameters": {
          "properties": {
            "depth": {
              "description": "The maximum depth to traverse",
              "type": "integer"
            },
            "ignore": {
              "description": "List of glob patterns to ignore",
              "items": {},
              "type": "array"
            },
            "path": {
              "description": "The path to the directory to list (defaults to current working directory)",
              "type": "string"
            }
          },
          "required": [],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Apply several string replacements to one file in order.",
        "name": "multiedit",
        "parameters": {
          "properties": {
            "edits": {
              "description": "Array of edit operations to perform sequentially on the file",
              "items": {},
              "type": "array"
            },
            "file_path": {
              "description": "The absolute path to the file to modify",
              "type": "string"
            }
          },
          "required": [
            "file_path",
            "edits"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Search public code with Sourcegraph.",
        "name": "sourcegraph",
        "parameters": {
          "properties": {
            "context_window": {
              "description": "The context around the match to return (default: 10 lines)",
              "type": "integer"
            },
            "count": {
              "description": "Optional number of results to return (default: 10, max: 20)",
              "type": "integer"
            },
            "query": {
              "description": "The Sourcegraph search query",
              "type": "string"
            },
            "timeout": {
              "description": "Optional timeout in seconds (max 120)",
              "type": "integer"
            }
          },
          "required": [
            "query"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Read a file with line numbers.",
        "name": "view",
        "parameters": {
          "properties": {
            "file_path": {
              "description": "The path to the file to read",
              "type": "string"
            },
            "limit": {
              "description": "The number of lines to read (defaults to 2000)",
              "type": "integer"
            },
            "offset": {
              "description": "The line number to start reading from (0-based)",
              "type": "integer"
            }
          },
          "required": [
            "file_path"
          ],
          "type": "object"
        },
        "strict": false
      }
    },
    {
      "type": "function",
      "function": {
        "description": "Write a file, replacing any existing file.",
        "name": "write",
        "parameters": {
          "properties": {
            "content": {
              "description": "The content to write to the file",
              "type": "string"
            },
            "file_path": {
              "description": "The path to the file to write",
              "type": "string"
            }
          },
          "required": [
            "file_path",
            "content"
          ],
          "type": "object"
        },
        "strict": false
      }
    }
  ],
  "tool_choice": "auto",
  "max_tokens": 60000
};
