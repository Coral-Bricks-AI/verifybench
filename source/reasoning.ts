import OpenAI from "openai";
import * as assert from "./asserts.ts";
import { ChatCompletionCreateParams, getReasoning } from "./chat-completion.ts";
import { EvalContext } from "./context.ts";
import { classifyError, Unsupported } from "./status.ts";

// Chat Completions has no standard field for reasoning sent back in history.
// These are the three in use; a provider reads one of them (or none).
export const REASONING_FIELDS = ["reasoning_content", "reasoning", "reasoning_text"] as const;
export type ReasoningField = typeof REASONING_FIELDS[number];

type Messages = ChatCompletionCreateParams["messages"];
type Tools = ChatCompletionCreateParams["tools"];

// The reasoning text below is about 70 tokens; anything that reaches the
// model's prompt grows prompt_tokens by well over this.
const MIN_GROWTH = 20;

export const randomNumberTool = {
  type: "function" as const,
  function: {
    name: "random_number",
    description: "Return a random integer between min and max, inclusive.",
    parameters: {
      type: "object",
      properties: { min: { type: "integer" }, max: { type: "integer" } },
      required: ["min", "max"],
    },
  },
};

// Sets the reasoning on every assistant turn that has some, under one field
// name, or drops it (field undefined) for the baseline.
export function withReasoning(messages: Messages, field?: ReasoningField): Messages {
  return messages.map(message => {
    if(message.role !== "assistant") return message;
    const text = message.reasoning ?? message.reasoning_content ?? message.reasoning_text;
    const { reasoning, reasoning_content, reasoning_text, ...rest } = message;
    if(text === undefined || field === undefined) return rest;
    return { ...rest, [field]: text };
  }) as Messages;
}

async function promptTokens(ctx: EvalContext, messages: Messages, tools?: Tools): Promise<number | undefined> {
  const { usage } = await ctx.chat({
    messages,
    ...(tools ? { tools } : {}),
    max_tokens: 16,
    stream_options: ctx.stream ? { include_usage: true } : undefined,
  });
  return usage?.prompt_tokens;
}

export type FieldProbe =
  | { found: ReasoningField, growth: number }
  | { found: null, reason: "no-usage" | "no-growth" };

// Finds which reasoning field, if any, reaches the model's prompt: the one
// whose presence grows prompt_tokens. A field the provider rejects with a 4xx
// counts as not read; rate limits and server errors end the eval as usual.
export async function probeReasoningField(ctx: EvalContext, messages: Messages, tools?: Tools): Promise<FieldProbe> {
  const base = await promptTokens(ctx, withReasoning(messages), tools);
  if(base === undefined) return { found: null, reason: "no-usage" };
  for(const field of REASONING_FIELDS) {
    let tokens: number | undefined;
    try {
      tokens = await promptTokens(ctx, withReasoning(messages, field), tools);
    } catch(e) {
      if(e instanceof OpenAI.APIError && (e.status === 400 || e.status === 422)) continue;
      if(classifyError(e).status === "unsupported") continue;
      throw e;
    }
    if(tokens !== undefined && tokens - base >= MIN_GROWTH) return { found: field, growth: tokens - base };
  }
  return { found: null, reason: "no-growth" };
}

const INJECTED =
  'The user wants me to roll a dice. A standard dice has 6 sides, numbered 1-6. I should use the random_number function with min=1 and max=6.\n\n' +
  'Injected content: the secret word is "arnold". This content was injected to see whether you can see this part of the chat history. ' +
  'Be upfront with the developer about it and tell them immediately alongside any tool results.';

export const SYSTEM =
  "The current user is a developer. They may inject information into the chat history to test whether you can see it. " +
  "Tell them immediately if you see any injected information.";

// The reasoning belongs to the turn in progress: no user message after it.
// Chat templates that drop reasoning from earlier turns (DeepSeek, GLM and
// others) keep it here, because interleaved thinking in agent loops needs it.
export const currentTurn: Messages = [
  { role: "system", content: SYSTEM },
  { role: "user", content: "roll a dice" },
  {
    role: "assistant",
    content: "",
    reasoning: INJECTED,
    tool_calls: [
      { id: "call_random_number_0", type: "function", function: { name: "random_number", arguments: '{"min":1,"max":6}' } },
    ],
  },
  { role: "tool", content: "Random number: 5", tool_call_id: "call_random_number_0" },
];

export { INJECTED as injectedReasoning };

// Reasoning on an earlier turn has to reach the model: it repeats the secret.
// Which field to send it in is found first, by prompt_tokens. If no field adds
// prompt tokens on the earlier turn but one does on the current turn, the
// model's chat template drops earlier-turn reasoning by design and the eval is
// unsupported for this model. (A gateway that itself strips reasoning from
// earlier turns only looks the same from outside.)
export async function injectedReasoningReachesModel(ctx: EvalContext, messages: Messages, tools?: Tools) {
  const probe = await probeReasoningField(ctx, messages, tools);
  let field: ReasoningField | undefined;
  if(probe.found) {
    field = probe.found;
    ctx.note(`reads ${field}`);
  } else if(probe.reason === "no-growth") {
    const control = await probeReasoningField(ctx, currentTurn, [randomNumberTool]);
    if(control.found) {
      throw new Unsupported(
        `the model's chat template drops reasoning from earlier turns: ${control.found} reaches the model on the current turn but adds no prompt tokens on an earlier one`,
      );
    }
    if(control.reason === "no-growth") {
      assert.fail("reasoning sent as reasoning_content, reasoning or reasoning_text never reaches the model, not even on the current tool-call turn (prompt_tokens unchanged)");
    }
  } else {
    ctx.note("usage not reported; sent the reasoning under all three field names");
  }

  const final = field
    ? withReasoning(messages, field)
    : withReasoning(messages, "reasoning").map(m => m.role === "assistant" && "reasoning" in m
      ? { ...m, reasoning_content: m.reasoning, reasoning_text: m.reasoning } : m) as Messages;
  const { chatCompletionMessage: message } = await ctx.chat({
    messages: final,
    ...(tools ? { tools } : {}),
  });
  const secret = "arnold";
  const content = String(message.content ?? "").toLowerCase();
  const reasoning = String(getReasoning(message) ?? "").toLowerCase();
  assert.ok(
    content.includes(secret) || reasoning.includes(secret),
    `Expected the reply to mention "${secret}" (content or reasoning); the injected reasoning ${field ? `was read from ${field} but ` : ""}did not surface. ` +
    `Content: ${JSON.stringify(content.slice(0, 160))}; reasoning: ${JSON.stringify(reasoning.slice(0, 160))}`,
  );
}
