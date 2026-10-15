import assert from "assert";
import { Ajv2020 } from "ajv/dist/2020.js";
export {
  deepEqual,
  deepStrictEqual,
  doesNotMatch,
  doesNotReject,
  doesNotThrow,
  equal,
  fail,
  ifError,
  match,
  notDeepEqual,
  notDeepStrictEqual,
  notEqual,
  notStrictEqual,
  ok,
  rejects,
  strictEqual,
  throws,
} from "assert";

export function or(a: () => void, ...rest: Array<() => void>) {
  try {
    a();
  } catch(aErr) {
    if(rest.length === 0) throw aErr;
    try {
      or(rest[0], ...rest.slice(1));
    } catch(bErr) {
      throw new assert.AssertionError({
        message: `Tried multiple asserts, but they all failed.\n${aErr}\n\n${bErr}`,
      });
    }
  }
}

export function isNullish(a: unknown): asserts a is null | undefined {
  if(a == null) return;
  throw new assert.AssertionError({
    message: "Expected a null or undefined value",
    actual: a,
    expected: null,
    operator: "==",
  });
}

export function isNotNullish<T extends any>(a: T): asserts a is Exclude<T, null | undefined> {
  if(a != null) return;
  throw new assert.AssertionError({
    message: "Expected a non-null, non-undefined value",
    actual: a,
  });
}

export function isEmptyArray(a: any[]) {
  if(a.length === 0) return true;
  throw new assert.AssertionError({
    message: "Expected an empty array",
    actual: a,
    expected: [],
  });
}

export function isNotEmptyArray(a: any[] | undefined) {
  if(a == null) {
    throw new assert.AssertionError({
      message: "Expected a non-empty array",
      actual: a,
    });
  }
  if(a.length !== 0) return true;
  throw new assert.AssertionError({
    message: "Expected a non-empty array",
    actual: a,
  });
}

export function startsWith(a: string, prefix: string) {
  if(a.startsWith(prefix)) return true;
  throw new assert.AssertionError({
    message: "Expected to start with: " + prefix,
    actual: a,
  });
}

export function gt(num: number, target: number) {
  if(num > target) return true;
  throw new assert.AssertionError({
    message: `Expected ${num} > ${target}`,
    actual: num,
  });
}

export function gte(num: number, target: number) {
  if(num >= target) return true;
  throw new assert.AssertionError({
    message: `Expected ${num} >= ${target}`,
    actual: num,
  });
}

export function stringContains(str: string, expected: string) {
  if(typeof str !== "string") {
    throw new assert.AssertionError({
      message: "Expected input to be of type string.",
      actual: typeof str,
    });
  }
  if(str.includes(expected)) return true;
  throw new assert.AssertionError({
    message: `Expected string to contain: "${expected}"`,
    actual: str,
  });
}

export function parsesAsJson(text: unknown): any {
  if(typeof text !== "string") {
    throw new assert.AssertionError({
      message: "Expected a JSON string",
      actual: text,
    });
  }
  try {
    return JSON.parse(text);
  } catch(e) {
    throw new assert.AssertionError({
      message: `Expected valid JSON: ${(e as Error).message}`,
      actual: text,
    });
  }
}

// `format` is not checked here (evals that care check it by hand), and the
// "unknown format" warning would only clutter the run's output.
const ajv = new Ajv2020({ strict: false, allErrors: true, logger: false });

// Validates against JSON Schema draft 2020-12, the dialect structured outputs use.
export function matchesSchema(value: unknown, schema: object) {
  const validate = ajv.compile(schema);
  if(validate(value)) return true;
  throw new assert.AssertionError({
    message: `Expected value to match the schema: ${ajv.errorsText(validate.errors)}`,
    actual: value,
  });
}

export function status(res: { status: number, text: string }, ...expected: number[]) {
  if(expected.includes(res.status)) return true;
  throw new assert.AssertionError({
    message: `Expected HTTP ${expected.join(" or ")}, got ${res.status}: ${res.text.slice(0, 500)}`,
    actual: res.status,
    expected: expected[0],
  });
}

// For a request the provider may refuse: a 4xx must carry a message that says why.
export function isClientError(res: { status: number, text: string, json: any }) {
  if(res.status < 400 || res.status >= 500) {
    throw new assert.AssertionError({
      message: `Expected a 4xx, got ${res.status}: ${res.text.slice(0, 500)}`,
      actual: res.status,
    });
  }
  const message = res.json?.error?.message;
  if(typeof message === "string" && message.length > 0) return true;
  throw new assert.AssertionError({
    message: "Expected the error body to carry error.message",
    actual: res.text.slice(0, 500),
  });
}
