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
    const errMsg = typeof (value as any).error === "string"
      ? (value as any).error
      : String((value as any).error);
    return { ok: false, error: errMsg };
  }

  if (isOption(value)) {
    if (value.isSome) {
      return { ok: true, value: (value as any).value };
    }
    return { ok: false, error: "Option was None" };
  }

  return { ok: true, value };
}
