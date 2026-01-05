import type { Ok, Err, Result, ResultMethods } from "./result";
import type { Some, None } from "./option";

/**
 * Pattern matching for `Result` and `Option` — exhaustiveness enforced.
 *
 * Returns the value returned by the selected handler. If all handlers return
 * `Result` or `Option`, TypeScript will infer that automatically.
 */
export function match<T, E, R>(
  value: Result<T, E> | (Result<any, any> & ResultMethods<any>),
  patterns: {
    Ok: ((v: Ok<T>) => R) | (() => R);
    Err: ((e: Err<E>) => R) | (() => R);
  },
): R;

export function match<T, R>(
  value: Some<T> | None,
  patterns: {
    Some: ((v: Some<T>) => R) | (() => R);
    None: ((v: None) => R) | (() => R);
  },
): R;

export function match(value: any, patterns: any): any {
  const handler = patterns[value.type];
  if (!handler) {
    throw new Error(
      `Non-exhaustive match — missing handler for '${value.type}'`,
    );
  }

  return handler(value);
}

/**
 * Allowed keys in matchAll patterns.
 * - Strings, numbers, and Atom descriptions.
 * - Booleans are represented as "true" | "false" strings
 */
type MatchKey = string | number | symbol;

/**
 * Type-safe pattern object: must always have `_` fallback.
 */
type MatchPatterns<V> = {
  [K in MatchKey]?: (v: V) => unknown;
} & { _: () => unknown };

/**
 * Extracts return types from all handlers in a patterns object as a union.
 * Allows each arm to return a different type.
 */
type InferReturnTypes<P> = {
  [K in keyof P]: P[K] extends (...args: any[]) => infer R ? R : never;
}[keyof P];

const runtimeMatchKeyCheck = (key: any): key is MatchKey => {
  return (
    typeof key === "string" ||
    typeof key === "number" ||
    typeof key === "boolean" ||
    typeof key === "symbol"
  );
};

/**
 * Matches a value against literal or Atom cases by *semantic name*.
 * - Supports string, number, booleans and Atom (symbol) values.
 * - Unsupported will throw an error. (objects, arrays, functions, etc)
 * - For Atoms, uses their description as a key (e.g. atom("ready") → "ready").
 * - Requires a `_` default handler.
 *
 * @example
 * matchAll(ready, {
 *   1: () => println("One"),
 *   2: () => println("Two"),
 *   0: () => println("Zero"),
 *   true: () => println("True"),
 *   false: () => println("False"),
 *   ready: () => println("Ready!"),
 *   failed: () => println("Failed!"),
 *   _: () => println("Unknown!"),
 * });
 */
export function matchAll<
  T extends MatchKey | boolean,
  P extends MatchPatterns<T>,
>(value: T, patterns: P): InferReturnTypes<P> {
  const unbox = (v: any) =>
    typeof v?.valueOf === "function" ? v.valueOf() : v;
  const getSymbol = (v: any) =>
    typeof v === "symbol" ? v.description : undefined;
  const raw = unbox(value);

  if (!runtimeMatchKeyCheck(raw)) {
    throw new Error(`Unsupported match all value type: ${typeof raw}`);
  }

  const key = getSymbol(raw) ?? raw;

  const normalizedKey =
    typeof key === "boolean" || typeof key === "number" ? String(key) : key;

  if (normalizedKey != null && normalizedKey in patterns) {
    return (patterns as any)[normalizedKey]!(value);
  }

  return patterns._() as InferReturnTypes<P>;
}
