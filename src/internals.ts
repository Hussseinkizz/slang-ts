import type { Result } from "./result";
import type { Option } from "./option";

/**
 * Schedules a microtask; falls back to Promise if unavailable.
 * Used internally for deferred error handling in unwrap chains.
 */
export const scheduleMicrotask = (fn: () => void) => {
  const qmt = (globalThis as any)?.queueMicrotask as (
    cb: () => void,
  ) => void | undefined;
  if (typeof qmt === "function") qmt(fn);
  else Promise.resolve().then(fn);
};

/** Type guard for Result */
export const isResult = (value: unknown): value is Result<unknown, unknown> =>
  value != null &&
  typeof value === "object" &&
  "type" in value &&
  (value.type === "Ok" || value.type === "Err");

/**
 * Hidden activation hook carried by lifecycle signals (task.done, runner.done).
 * Lets defer chains activate their source task when awaited.
 */
export const ACTIVATE_HOOK: unique symbol = Symbol("slang.activate");

export type Activatable = { [ACTIVATE_HOOK]?: () => void };

/** Type guard for Option */
export const isOption = (value: unknown): value is Option<unknown> =>
  value != null &&
  typeof value === "object" &&
  "isSome" in value &&
  "isNone" in value;

/** Type guard for Atom (boxed symbol) */
export const isAtom = (value: unknown): boolean =>
  value != null &&
  typeof value === "object" &&
  typeof (value as any).valueOf?.() === "symbol";

/** Evaluated value result type */
export type EvaluatedValue = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * Extracts inner value from Slang types (Atom, Result, Option) or plain values.
 * Returns a discriminated union indicating success or failure.
 */
export function evaluateValue<T>(value: T): EvaluatedValue {
  if (isAtom(value)) {
    const sym = (value as any).valueOf() as symbol;
    return { ok: true, value: sym.description };
  }

  if (isResult(value)) {
    if (value.isOk) {
      return { ok: true, value: (value as any).value };
    }
    return { ok: false, error: describeThrown((value as any).error) };
  }

  if (isOption(value)) {
    if (value.isSome) {
      return { ok: true, value: (value as any).value };
    }
    return { ok: false, error: "Option was None" };
  }

  return { ok: true, value };
}

/** First non-empty string among the common error fields of an object. */
function readMessageField(value: object): string | undefined {
  const record = value as Record<string, unknown>;
  for (const key of ["message", "error", "reason"]) {
    const field = record[key];
    if (typeof field === "string" && field.length > 0) return field;
  }
  return undefined;
}

/** Truncates one long message so a large payload cannot flood a log. */
function clampMessage(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

/** JSON text for a value, guarding bigint, cycles, functions and symbols. */
function stringifyGuarded(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    const text = JSON.stringify(value, (_key, held) => {
      if (typeof held === "bigint") return held.toString();
      if (typeof held === "function" || typeof held === "symbol") return undefined;
      if (held !== null && typeof held === "object") {
        if (seen.has(held)) return "[Circular]";
        seen.add(held);
      }
      return held;
    });
    if (typeof text === "string" && text.length > 0 && text !== "{}") return text;
  } catch {
    // fall through to the tag
  }
  return Object.prototype.toString.call(value);
}

/**
 * Readable text for any thrown value.
 * A thrown value is not always an Error: fetch wrappers and some database drivers
 * throw plain objects, and a bare `String(value)` gives "[object Object]" for those.
 * Resolve the common shapes, then fall back to a guarded stringify, bounded in length.
 * The Error and string branches match the previous behaviour exactly.
 */
export function describeThrown(value: unknown, maxLength = 512): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  if (value === null || value === undefined) return String(value);
  if (typeof value === "object") {
    const field = readMessageField(value);
    if (field !== undefined) return clampMessage(field, maxLength);
    return clampMessage(stringifyGuarded(value), maxLength);
  }
  return String(value);
}

/** Marker used to recognise the invariant panic for a nested Result. */
const NESTED_RESULT_MARKER = "slang.nestedResultPanic";

/**
 * Panics because a Result would nest inside another Result.
 * Every utility unwraps; one that would still hold a Result at the end throws here.
 */
export function panicNestedResult(): never {
  const error = new Error("A Result cannot be nested inside another Result");
  Object.defineProperty(error, NESTED_RESULT_MARKER, { value: true });
  throw error;
}

/** True when an error came from `panicNestedResult`. */
export function isNestedResultPanic(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as unknown as Record<string, unknown>)[NESTED_RESULT_MARKER] === true
  );
}
