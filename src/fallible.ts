import { Err, buildOk } from "./result";
import type { Result } from "./result";

/**
 * Stable codes for fallible collection chains.
 * Callers branch on the code; the message is for a human.
 */
export type SlangErrorCode =
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
  /** The failure code, or `undefined` when the outcome succeeded. */
  readonly code: SlangErrorCode | undefined;
  /** Returns the value, or the fallback when the chain failed. */
  else(fallback: T | ((error: string) => T)): T;
  /** Returns the value, or throws when the chain failed. */
  panic(message?: string): T;
};

/**
 * Wraps an outcome with the terminal resolution surface.
 * @internal
 */
export function createFallible<T>(
  outcome: Result<T, string>,
  code: SlangErrorCode | undefined,
): Fallible<T> {
  return {
    outcome,
    code,
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

/** A coded failure. @internal */
export function fail<T>(code: SlangErrorCode, message: string): Fallible<T> {
  return createFallible(Err(message) as unknown as Result<T, string>, code);
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
      source.code,
    );
  }
  return step(source.outcome.value);
}
