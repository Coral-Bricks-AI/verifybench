import OpenAI from "openai";
import { ReasoningEffort } from "openai/resources";
import { Stream } from "openai/streaming";
import {
  ChatCompletionChunkWithReasoning, ChatCompletionCreateParams, ChatCompletionMessage, getReasoning,
} from "./chat-completion.ts";
import { classifyHttp, errorText, InfraError, oneLine, Skipped, Unsupported } from "./status.ts";

// Output cap for every generating request that doesn't set its own. Generous
// enough for a reasoning model at high effort to think and still answer, and
// low enough that a provider that never stops (or loops) costs a bounded amount.
// Chat Completions gets max_tokens, Responses max_output_tokens; Messages
// requests always carry max_tokens because the API requires it.
export const DEFAULT_MAX_TOKENS = 16384;

// Kept for evals written against the earlier API: ctx.skip() throws this.
export { Skipped as SkipEval };

export type RequestOptions = {
  // Hand back 5xx responses instead of throwing InfraError, for evals whose
  // subject is the error response itself. 429s are still retried and still
  // end the eval as infra_error: a rate limit is never the answer under test.
  raw?: boolean,
};

export type RawResponse = {
  status: number,
  headers: Headers,
  text: string,
  // Parsed body, or undefined when the body isn't JSON.
  json: any,
};

export type SseEvent = {
  event?: string,
  // Parsed `data:` payload, or the raw string when it isn't JSON (e.g. [DONE]).
  data: any,
};

export type SseResponse = RawResponse & { events: SseEvent[] };

export type ChatResult = {
  chatCompletionMessage: ChatCompletionMessage,
  chatCompletionChunks?: ChatCompletionChunkWithReasoning[],
  finishReason: string | null,
  usage?: OpenAI.CompletionUsage | null,
};

export type ResponsesResult = {
  // The final response object: the body when not streaming, or the one carried
  // by the terminal event when streaming.
  response: any,
  events?: SseEvent[],
  raw: RawResponse,
};

export type MessagesResult = {
  // The Anthropic message: the body when not streaming, or the message
  // assembled from the stream events.
  message: any,
  events?: SseEvent[],
  raw: RawResponse,
};

export type EvalContext = {
  model: string,
  // Whether this run exercises the streaming form of each route.
  stream: boolean,
  reasoningEffort?: ReasoningEffort,
  openai: OpenAI,
  // Chat Completions, streamed or not according to `stream`.
  chat(json: ChatCompletionCreateParams): Promise<ChatResult>,
  // POST /responses, streamed or not according to `stream`.
  responses(body: Record<string, unknown>): Promise<ResponsesResult>,
  // POST /messages (Anthropic), streamed or not according to `stream`.
  messages(body: Record<string, unknown>): Promise<MessagesResult>,
  // A plain HTTP call against the base URL. Retries 429s and 5xx, then ends the
  // eval as infra_error on either (unless opts.raw); any other status, 4xx
  // included, is handed back for the eval to judge.
  request(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<RawResponse>,
  // The same, reading the body as server-sent events.
  sse(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<SseResponse>,
  // Ends the eval as unsupported when the response says the route or the
  // feature isn't offered: 404, 405, 501, or a 400/422 that says so.
  supported(res: RawResponse, what?: string): void,
  // Ends the eval as unsupported: the provider doesn't offer what it tests.
  unsupported(reason: string): never,
  // Ends the eval as skipped: this sample couldn't exercise what it tests.
  skip(reason: string): never,
  // Something worth reporting about a pass, e.g. "refused the keyword" where
  // enforcing it and refusing it are both correct. Cleared before each eval.
  notes: string[],
  note(text: string): void,
};

const TERMINAL_RESPONSE_EVENTS = new Set([
  "response.completed", "response.incomplete", "response.failed", "response.cancelled",
]);

export function parseSse(text: string): SseEvent[] {
  const events: SseEvent[] = [];
  for(const block of text.split(/\r?\n\r?\n/)) {
    let event: string | undefined;
    const data: string[] = [];
    for(const line of block.split(/\r?\n/)) {
      if(line.startsWith("event:")) event = line.slice(6).trim();
      else if(line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if(data.length === 0) continue;
    const joined = data.join("\n");
    try {
      events.push({ event, data: JSON.parse(joined) });
    } catch {
      events.push({ event, data: joined });
    }
  }
  return events;
}

// Rebuilds an Anthropic message from its stream events.
export function assembleMessage(events: SseEvent[]) {
  let message: any;
  const partialJson = new Map<number, string>();
  for(const { data } of events) {
    if(data == null || typeof data !== "object") continue;
    if(data.type === "message_start") message = structuredClone(data.message);
    if(!message) continue;
    if(data.type === "content_block_start") {
      message.content[data.index] = structuredClone(data.content_block);
    }
    if(data.type === "content_block_delta") {
      const block = message.content[data.index];
      const delta = data.delta ?? {};
      if(!block) continue;
      if(delta.type === "text_delta") block.text = (block.text ?? "") + delta.text;
      if(delta.type === "thinking_delta") block.thinking = (block.thinking ?? "") + delta.thinking;
      if(delta.type === "signature_delta") block.signature = (block.signature ?? "") + delta.signature;
      if(delta.type === "input_json_delta") {
        partialJson.set(data.index, (partialJson.get(data.index) ?? "") + delta.partial_json);
      }
    }
    if(data.type === "content_block_stop" && partialJson.has(data.index)) {
      const json = partialJson.get(data.index)!;
      // Left as the raw string when it doesn't parse, so the eval's own assert reports it.
      try { message.content[data.index].input = json === "" ? {} : JSON.parse(json); }
      catch { message.content[data.index].input = json; }
    }
    if(data.type === "message_delta") {
      // Field by field, as the Anthropic SDK does, so a stray key in the delta
      // can't overwrite part of the message.
      if("stop_reason" in (data.delta ?? {})) message.stop_reason = data.delta.stop_reason;
      if("stop_sequence" in (data.delta ?? {})) message.stop_sequence = data.delta.stop_sequence;
      if(data.usage) message.usage = { ...message.usage, ...data.usage };
    }
  }
  return message;
}

export function createContext({ client, apiKey, baseUrl, model, stream, reasoningEffort, retry429 = false, timeoutMs = 600_000 }: {
  client: OpenAI,
  apiKey: string,
  baseUrl: string,
  model: string,
  stream: boolean,
  reasoningEffort?: ReasoningEffort,
  // Wait out HTTP 429s for longer (12 tries, 10 s apart): for accounts with a low request rate.
  retry429?: boolean,
  // Per request.
  timeoutMs?: number,
}): EvalContext {
  const base = baseUrl.replace(/\/$/, "");

  async function request(method: string, path: string, body?: unknown, opts: RequestOptions = {}): Promise<RawResponse> {
    const headers: Record<string, string> = { "authorization": `Bearer ${apiKey}` };
    if(path.startsWith("/messages")) {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    }
    if(body !== undefined) headers["content-type"] = "application/json";
    const max429 = retry429 ? 12 : 3;
    const max5xx = opts.raw ? 0 : 2;
    let tries429 = 0;
    let tries5xx = 0;
    while(true) {
      let res: Response;
      let text: string;
      try {
        res = await fetch(base + path, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
        text = await res.text();
      } catch(e) {
        const err = e as Error;
        if(err.name === "TimeoutError" || err.name === "AbortError") {
          throw new InfraError(`${method} ${path} timed out after ${Math.round(timeoutMs / 1000)} s`);
        }
        throw new InfraError(`${method} ${path}: connection failed: ${err.message}`);
      }
      let json: any;
      try { json = JSON.parse(text); } catch {}
      const status = res.status;
      if(status === 429) {
        if(++tries429 < max429) {
          await sleep(retry429 ? 10_000 : 2_000 * tries429);
          continue;
        }
        throw new InfraError(`${method} ${path}: HTTP 429 after ${tries429} tries: ${oneLine(errorText(json, text), 200)}`);
      }
      if(status >= 500 && status !== 501 && !opts.raw) {
        if(++tries5xx <= max5xx) {
          await sleep(2_000 * tries5xx);
          continue;
        }
        throw new InfraError(`${method} ${path}: HTTP ${status}: ${oneLine(errorText(json, text), 200)}`);
      }
      return { status, headers: res.headers, text, json };
    }
  }

  async function sse(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<SseResponse> {
    const res = await request(method, path, body, opts);
    return { ...res, events: res.json === undefined ? parseSse(res.text) : [] };
  }

  const ctx: EvalContext = {
    model, stream, reasoningEffort, openai: client, request, sse,

    chat: (json) => chat(client, model, withChatCap(json), stream, reasoningEffort),

    async responses(body) {
      const full = {
        model,
        ...(!("max_output_tokens" in body) ? { max_output_tokens: DEFAULT_MAX_TOKENS } : {}),
        ...(reasoningEffort && !("reasoning" in body) ? { reasoning: { effort: reasoningEffort } } : {}),
        ...body,
      };
      if(!stream) {
        const raw = await request("POST", "/responses", full);
        ctx.supported(raw);
        return { response: raw.json, raw };
      }
      const raw = await sse("POST", "/responses", { ...full, stream: true });
      ctx.supported(raw);
      const terminal = raw.events.find(e => TERMINAL_RESPONSE_EVENTS.has(e.data?.type));
      // An error body instead of a stream is handed back as-is, so the eval can assert on it.
      return { response: terminal?.data?.response ?? raw.json, events: raw.events, raw };
    },

    async messages(body) {
      const full = { model, ...body };
      if(!stream) {
        const raw = await request("POST", "/messages", full);
        ctx.supported(raw);
        return { message: raw.json, raw };
      }
      const raw = await sse("POST", "/messages", { ...full, stream: true });
      ctx.supported(raw);
      return { message: raw.json ?? assembleMessage(raw.events), events: raw.events, raw };
    },

    supported(res, what) {
      if(classifyHttp(res.status, res.json, res.text) !== "unsupported") return;
      const reason = res.status === 400 || res.status === 422
        ? `HTTP ${res.status}: ${oneLine(errorText(res.json, res.text), 200)}`
        : `HTTP ${res.status}`;
      throw new Unsupported(`${what ?? "route or feature"} not offered (${reason})`);
    },

    unsupported(reason) {
      throw new Unsupported(reason);
    },

    skip(reason) {
      throw new Skipped(reason);
    },

    notes: [],
    note(text) {
      ctx.notes.push(text);
    },
  };
  return ctx;
}

export function withChatCap(json: ChatCompletionCreateParams): ChatCompletionCreateParams {
  if(json.max_tokens != null || json.max_completion_tokens != null) return json;
  return { ...json, max_tokens: DEFAULT_MAX_TOKENS };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// One Chat Completions request, streamed or not; the streamed chunks are
// assembled into the same message shape the non-streamed body has.
export async function chat(
  client: OpenAI,
  model: string,
  json: ChatCompletionCreateParams,
  stream: boolean,
  reasoningEffort?: ReasoningEffort,
): Promise<ChatResult> {
  if(!stream) {
    const response = await client.chat.completions.create({
      ...json,
      reasoning_effort: reasoningEffort,
      stream,
      model,
    } as OpenAI.ChatCompletionCreateParamsNonStreaming);
    return {
      chatCompletionMessage: response.choices[0].message as ChatCompletionMessage,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage,
    };
  }

  const msg: Partial<ChatCompletionMessage> = {};

  const chunkStream = await (client.chat.completions.create({
    ...json,
    reasoning_effort: reasoningEffort,
    model,
    stream: true,
  } as OpenAI.ChatCompletionCreateParamsStreaming) as unknown as Stream<ChatCompletionChunkWithReasoning>);

  const chunks: ChatCompletionChunkWithReasoning[] = [];
  let finishReason: string | null = null;
  let usage: OpenAI.CompletionUsage | null | undefined;
  let lastIndex: number | null = null;
  let toolBuffer: {
    id?: string,
    type: "function",
    index: number,
    function: {
      name?: string,
      arguments?: string,
    },
  } | null = null;
  for await(const chunk of chunkStream) {
    chunks.push(chunk);
    if(chunk.usage) usage = chunk.usage;
    if(!chunk.choices) continue;
    const choice = chunk.choices[0];
    if(!choice) continue;
    if(choice.finish_reason != null) finishReason = choice.finish_reason;
    const content = choice.delta.content;
    const tools = choice.delta.tool_calls;
    const reasoning = getReasoning(choice.delta);
    if(content) {
      if(!msg.content) msg.content = "";
      msg.content += content;
    }
    if(tools) {
      for(const toolDelta of tools) {
        if(lastIndex == null) lastIndex = toolDelta.index;
        if(lastIndex !== toolDelta.index && toolBuffer != null) {
          msg.tool_calls ||= [];
          // @ts-ignore
          msg.tool_calls.push(toolBuffer);
          toolBuffer = {
            index: toolDelta.index,
            type: "function",
            function: {},
          };
        }
        if(!toolBuffer) {
          toolBuffer = {
            index: toolDelta.index,
            type: "function",
            function: {}
          };
        }
        lastIndex = toolDelta.index;
        if(toolDelta.id) toolBuffer.id = toolDelta.id;
        if(toolDelta.function) {
          if(toolDelta.function.name) {
            toolBuffer.function.name ||= "";
            toolBuffer.function.name += toolDelta.function.name;
          }
          if(toolDelta.function.arguments) {
            toolBuffer.function.arguments ||= "";
            toolBuffer.function.arguments += toolDelta.function.arguments;
          }
        }
      }
    }
    if(reasoning) {
      if(!msg.reasoning_content) msg.reasoning_content = "";
      msg.reasoning_content += reasoning;
    }
  }

  if(toolBuffer) {
    msg.tool_calls ||= [];
    // @ts-ignore
    msg.tool_calls.push(toolBuffer);
  }

  return {
    chatCompletionMessage: msg as ChatCompletionMessage,
    chatCompletionChunks: chunks,
    finishReason,
    usage,
  };
}
