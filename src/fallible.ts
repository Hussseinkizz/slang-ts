import { Err, buildOk } from "./result";
import type { Result } from "./result";

/**
 * Stable categories for fallible collection chains.
 * Callers branch on the category; the message is for a human.
 */
export type SlangErrorCategory =
  | "INVALID_INPUT"
  | "INVALID_INDEX"
  | "OUT_OF_BOUNDS"
  | "INVALID_RANGE"
  | "INVALID_CHUNK_SIZE";

/**
 * A collection outcome that must be resolved with `.else(...)` or `.panic(...)`.
 * Operations short-circuit: once the chain fails, later steps do not run.
 */
export type Fallible<T> = {
  /** The underlying outcome, for composing chains. */
  readonly outcome: Result<T, string>;
  /** The failure category, or `undefined` when the outcome succeeded. */
  readonly category: SlangErrorCategory | undefined;
  /** Returns the value, or the fallback when the chain failed. */
  else(fallback: T | ((error: string) => T)): T;
  /** Returns the value, or throws when the chain failed. */
  panic(message?: string): T;
};

/**
 * Wraps a result so it can be resolved with `.else(...)` or `.panic(...)`.
 * @internal
 */
export function createFallible<T>(
  outcome: Result<T, string>,
  category: SlangErrorCategory | undefined,
): Fallible<T> {
  return {
    outcome,
    category,
    else(fallback) {
      if (outcome.isOk) return outcome.value;
      return typeof fallback === "function"
        ? (fallback as (error: string) => T)(outcome.error)
        : fallback;
    },
    panic(message) {
      if (outcome.isOk) return outcome.value;
      throw new Error(message ?? outcome.error);
    },
  };
}

/** A successful fallible value. @internal */
export function succeed<T>(value: T): Fallible<T> {
  return createFallible(buildOk(value), undefined);
}

/** A categorized failure. @internal */
export function fail<T>(category: SlangErrorCategory, message: string): Fallible<T> {
  return createFallible(Err(message) as unknown as Result<T, string>, category);
}

/**
 * Runs a step unless the source already failed.
 * @internal
 */
export function chain<T, U>(
  source: Fallible<T>,
  step: (value: T) => Fallible<U>,
): Fallible<U> {
  if (source.outcome.isErr) {
    return createFallible(
      Err(source.outcome.error) as unknown as Result<U, string>,
      source.category,
    );
  }
  return step(source.outcome.value);
}
