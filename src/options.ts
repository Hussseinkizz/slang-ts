import { Err, Ok, type Result, type ResultMethods } from "./result";
import { isFalsy } from "./option";

/**
 * Extracts the usable inner value of a value.
 * - `Some<T>` and `Ok<T>` unwrap to their inner value.
 * - Everything else (raw values, null, None, Err) returns as-is.
 */
const unwrapInner = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) return value;
  const tagged = value as { isSome?: boolean; isOk?: boolean; value?: unknown };
  if (tagged.isSome === true || tagged.isOk === true) return tagged.value;
  return value;
};

/**
 * Skips values that should not be returned as a result.
 * - `None` and `Err` are never usable.
 * - Anything whose unwrapped value is falsy (null, undefined, "", NaN,
 *   Infinity) is not usable either, e.g. `Ok("")` or a raw `null`.
 */
const isSkip = (value: unknown): boolean => {
  if (typeof value === "object" && value !== null) {
    const tagged = value as { isNone?: boolean; isErr?: boolean };
    if (tagged.isNone === true || tagged.isErr === true) return true;
  }
  return isFalsy(unwrapInner(value));
};

/**
 * Resolves the usable inner type of a value.
 * - `Some<U>` / `Ok<U>` contribute `U`.
 * - `None`, `Err`, null, undefined, and empty string contribute nothing.
 * - Raw values contribute themselves.
 */
export type OptionsValue<T> =
  T extends { isErr: true } | { isNone: true } | null | undefined | ""
    ? never
    : T extends { isSome: true; value: infer U }
      | { isOk: true; value: infer U }
      ? U
      : T;

/**
 * Returns the first usable value from a list as an `Ok`, or the fallback
 * `Err` if none is usable.
 *
 * Normalizes heterogeneous values — raw values, `Option`s, and `Result`s
 * from different sources — when all you care about is whether any of them
 * is usable. A value is usable when its unwrapped inner value is truthy;
 * `None`, `Err`, null, undefined, `""`, NaN, and Infinity are skipped.
 * Note that `0` and `false` are usable, matching `option()` semantics.
 *
 * @param values - Values to inspect in order; first usable one wins.
 * @param fallback - `Err` returned when no value is usable (default `Err("No value!")`).
 * @returns `Ok` of the first usable inner value, or the fallback.
 * @example
 * const a = null;
 * const b = option(undefined);
 * const c = Ok(true);
 * const d = Err("nope!");
 * Options([a, b, c, d]); // Ok(true) - c is usable
 *
 * const nothing = Options([a, option(null), Err("nope!")]); // Err("No value!")
 */
export function Options<T extends readonly unknown[]>(
  values: T,
  fallback: Err<string> & ResultMethods<never> = Err("No value!"),
): Result<OptionsValue<T[number]>, string> {
  for (const value of values) {
    if (isSkip(value)) continue;
    return Ok(unwrapInner(value) as OptionsValue<T[number]>);
  }
  return fallback;
}
