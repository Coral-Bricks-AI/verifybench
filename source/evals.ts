import fs from "fs/promises";
import path from "path";
import { ChatCompletionChunkWithReasoning, ChatCompletionCreateParams, ChatCompletionMessage } from "./chat-completion.ts";
import { EvalContext } from "./context.ts";

export type EvalTestParams = {
  chatCompletionMessage: ChatCompletionMessage,
  chatCompletionChunks?: ChatCompletionChunkWithReasoning[],
};


// One Chat Completions request and an assert on the message it returns.
export type JsonEvalModule = {
  test: (params: EvalTestParams) => any;
  json: ChatCompletionCreateParams;
};

// An eval that drives the provider itself: several requests, another route,
// or asserts on status codes and stream events.
export type ScriptEvalModule = {
  run: (ctx: EvalContext) => Promise<void>;
};

export type EvalModule = JsonEvalModule | ScriptEvalModule;

export type Eval = EvalModule & {
  name: string;
};

// `skip` lists eval directory names to leave out, e.g. ["reasoning", "messages"].
export async function getEvals(evalsPath?: string, skip: string[] = []): Promise<Eval[]> {
  const evals: Eval[] = [];
  const resolvedPath = evalsPath ?? path.join(import.meta.dirname, "..", "evals");

  for await (const testFile of findTestFiles(resolvedPath, skip)) {
    const module: EvalModule = await import(testFile);
    evals.push({ ...module, name: evalName(testFile) });
  }

  return evals;
}

export function evalName(file: string) {
  return `${path.basename(path.dirname(file))}/${path.basename(file).replace(/.js$/, "")}`
}

export async function* findTestFiles(dir: string, skip: string[]): AsyncGenerator<string> {
  try {
    await fs.stat(dir);
  } catch(e) {
    const pathname = `${dir}.js`;
    const stat = await fs.stat(pathname);
    if(stat.isFile()) {
      yield pathname;
      return;
    }
    throw e;
  }
  const entryNames = await fs.readdir(dir);
  const entries = await Promise.all(entryNames.map(async (entry) => {
    return {
      path: path.join(dir, entry),
      stat: await fs.stat(path.join(dir, entry)),
    };
  }));
  for(const entry of entries) {
    if(entry.stat.isFile() && entry.path.endsWith(".js")) {
      yield entry.path;
    }
    if(entry.stat.isDirectory()) {
      if(skip.includes(path.basename(entry.path))) continue;
      yield* findTestFiles(entry.path, skip);
    }
  }
}

