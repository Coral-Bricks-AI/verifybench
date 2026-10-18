import { EvalContext } from "./context.ts";

// How much a reply reasoned: the provider's own reasoning-token count when it reports one, otherwise
// the length of the reasoning it returned (about four characters a token).
export function chatReasoningTokens(body: any): number {
  const n = body?.usage?.completion_tokens_details?.reasoning_tokens;
  if(typeof n === "number") return n;
  const m = body?.choices?.[0]?.message ?? {};
  const text = m.reasoning_content ?? m.reasoning ?? m.reasoning_text ?? "";
  return Math.round(String(text).length / 4);
}

export function responsesReasoningTokens(body: any): number {
  const n = body?.usage?.output_tokens_details?.reasoning_tokens;
  if(typeof n === "number") return n;
  const text = (body?.output ?? []).filter((i: any) => i.type === "reasoning")
    .flatMap((i: any) => [...(i.summary ?? []), ...(i.content ?? [])]).map((c: any) => c.text ?? "").join("");
  return Math.round(text.length / 4);
}

// Messages reports no separate thinking count, so the thinking text's length stands in for it.
export function messagesThinkingTokens(body: any): number {
  const text = (body?.content ?? []).filter((b: any) => b.type === "thinking").map((b: any) => b.thinking ?? "").join("");
  return Math.round(text.length / 4);
}

// A question that takes real work (answer 50412), so effort has room to show: a short question is
// answered in a few hundred tokens at any effort and the levels blur into noise.
export const PUZZLE = "How many six-digit positive integers have digits that sum to 27? Work it out carefully, then reply with the number only.";

// The model's row on GET /models, when the provider lists models.
export async function modelRow(ctx: EvalContext): Promise<any | undefined> {
  const raw = await ctx.request("GET", "/models");
  if(raw.status !== 200) return undefined;
  const rows = raw.json?.data ?? raw.json?.models ?? [];
  return rows.find((r: any) => r.id === ctx.model || r.slug === ctx.model || r.name === ctx.model);
}

// The efforts the model offers, by the provider's own list on GET /models when it has one ("none" is
// not an effort to compare), otherwise low and high.
export async function effortLevels(ctx: EvalContext): Promise<string[]> {
  const row = await modelRow(ctx);
  const list: string[] = (row?.reasoning?.supported_efforts ?? row?.reasoning?.efforts ?? []).filter((e: string) => e !== "none");
  return list.length >= 2 ? list : ["low", "high"];
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

// Every effort level the provider offers has to mean something: each step up reasons at least 20% more
// than the one below. One sample is noise (reasoning length varies two-fold run to run), so three per
// level, compared by median, on a question that takes real work.
export async function assertEffortScales(ctx: EvalContext, ask: (effort: string) => Promise<any>, tokens: (body: any) => number, what: string) {
  const levels = await effortLevels(ctx);
  const first = await ask(levels[levels.length - 1]);
  ctx.supported(first, what);
  if(first.status !== 200) throw new Error(`Expected 200 at effort ${levels[levels.length - 1]}, got ${first.status}`);
  const runs = await Promise.all(levels.flatMap((lv, i) => (i === levels.length - 1 ? [ask(lv), ask(lv)] : [ask(lv), ask(lv), ask(lv)]).map((p) => p.then((r: any) => ({ lv, r })))));
  runs.push({ lv: levels[levels.length - 1], r: first });
  for(const { r } of runs) if(r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  const med = levels.map((lv) => median(runs.filter((x) => x.lv === lv).map((x) => tokens(x.r.json))));
  const shown = levels.map((lv, i) => `${lv} ${med[i]}`).join(", ");
  if(!(med[med.length - 1] > 0)) throw new Error(`Expected reasoning at the highest effort, got none (${shown})`);
  for(let i = 1; i < levels.length; i++)
    if(!(med[i] >= 1.2 * med[i - 1])) throw new Error(`Expected effort ${levels[i]} to reason at least 20% more than ${levels[i - 1]}; median reasoning tokens: ${shown}`);
}
