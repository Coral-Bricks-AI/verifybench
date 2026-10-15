import OpenAI from "openai";

// The four outcomes an eval can have, plus `skipped` for an eval that could
// not tell either way on this sample (see README, "Canonical use").
//
//   pass         the endpoint accepted the request and answered correctly
//   fail         the endpoint accepted the request and answered wrongly, or
//                rejected a valid request without saying the feature is unsupported
//   unsupported  the route or feature isn't offered: HTTP 404, 405 or 501, or a
//                400/422 whose error names the parameter or feature as unsupported
//   infra_error  HTTP 429 after retries, a 5xx, a timeout or a broken connection:
//                says nothing about correctness, rerun it
//   skipped      the sample didn't exercise what the eval checks (e.g. the model
//                finished inside a limit meant to cut it off)
export const STATUSES = ["pass", "fail", "unsupported", "infra_error", "skipped"] as const;
export type Status = typeof STATUSES[number];

// Thrown when the route or feature under test isn't offered.
export class Unsupported extends Error {
  override name = "Unsupported";
}

// Thrown when the run couldn't reach a verdict for reasons outside the endpoint's
// correctness: rate limits, server errors, timeouts, dropped connections.
export class InfraError extends Error {
  override name = "InfraError";
}

// Thrown when this sample didn't exercise the behaviour under test.
export class Skipped extends Error {
  override name = "Skipped";
}

// Words a provider uses when it refuses a parameter or feature it doesn't
// implement, as opposed to refusing a malformed request.
const UNSUPPORTED_WORDS = /\b(?:not supported|unsupported|not implemented|not yet supported|is not available|unrecognized (?:request )?(?:argument|parameter|field)|unknown (?:parameter|field|argument)|extra (?:inputs|fields) (?:are )?not permitted)\b/i;
const UNSUPPORTED_CODES = new Set([
  "unsupported_parameter", "unsupported_value", "unsupported_feature", "not_implemented", "unknown_parameter",
]);

export function errorText(body: any, fallback = ""): string {
  if(body == null) return fallback;
  if(typeof body === "string") return body;
  const err = body.error ?? body;
  const parts = [err?.message, err?.code, err?.type, err?.param, body?.detail, body?.message]
    .filter(part => typeof part === "string" && part.length > 0);
  return parts.length > 0 ? parts.join(" ") : fallback;
}

// How an HTTP error status maps onto the status model. `undefined` means the
// error is an answer like any other, and the eval decides what it means.
export function classifyHttp(status: number, body: any, text = ""): Status | undefined {
  if(status === 429 || status >= 500 && status !== 501) return "infra_error";
  if(status === 404 || status === 405 || status === 501) return "unsupported";
  if(status === 400 || status === 422) {
    const err = body?.error ?? body;
    const code = typeof err?.code === "string" ? err.code : typeof err?.type === "string" ? err.type : "";
    if(UNSUPPORTED_CODES.has(code)) return "unsupported";
    if(UNSUPPORTED_WORDS.test(errorText(body, text))) return "unsupported";
  }
  return undefined;
}

// Maps whatever an eval threw onto a status and a one-line reason.
export function classifyError(e: unknown): { status: Status, detail: string } {
  if(e instanceof Unsupported) return { status: "unsupported", detail: e.message };
  if(e instanceof InfraError) return { status: "infra_error", detail: e.message };
  if(e instanceof Skipped) return { status: "skipped", detail: e.message };
  if(e instanceof OpenAI.APIConnectionError) {
    return { status: "infra_error", detail: `connection failed: ${e.message}` };
  }
  if(e instanceof OpenAI.APIError) {
    const status = typeof e.status === "number" ? e.status : 0;
    const body = (e as any).error;
    const http = status ? classifyHttp(status, { error: body }, e.message) : undefined;
    if(http) return { status: http, detail: `HTTP ${status}: ${oneLine(e.message)}` };
    if(status >= 400 && status < 500) {
      return { status: "fail", detail: `rejected a valid request: HTTP ${status}: ${oneLine(e.message)}` };
    }
    return { status: "infra_error", detail: oneLine(e.message) };
  }
  if(e instanceof Error) {
    if(e.name === "TimeoutError" || e.name === "AbortError") return { status: "infra_error", detail: `timed out: ${e.message}` };
    const prefix = e.name === "AssertionError" ? "" : `${e.name}: `;
    return { status: "fail", detail: prefix + e.message };
  }
  return { status: "fail", detail: String(e) };
}

export function oneLine(text: string, max = 500) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

export function emptyTotals(): Record<Status, number> {
  return { pass: 0, fail: 0, unsupported: 0, infra_error: 0, skipped: 0 };
}
