import { Ok, Err, attachRaw, buildOk, type NestedValueGuard } from "./result";
import type { Result, Ok as OkType, Err as ErrType } from "./result";
import type { Some, None } from "./option";
import type { Atom } from "./atom";
import { evaluateValue, isAtom, isResult, isOption, describeThrown, panicNestedResult, isNestedResultPanic } from "./internals";

/** Final success value after resolving supported Slang wrappers. */
type SafeTryValue<T> = T extends Atom<infer Name>
  ? Name
  : T extends OkType<infer Value>
    ? SafeTryValue<Value>
    : T extends Some<infer Value>
      ? SafeTryValue<Value>
      : T extends ErrType<infer _Error>
        ? never
        : T extends None
          ? never
          : T;

/** Options for safeTry behavior */
type SafeTryOptions = {
  /** If true, re-throws thrown errors instead of capturing them. */
  throw?: boolean;
  /**
   * If true, collects every unwrapped layer and every failure on the returned
   * Result's non-enumerable `raw`, shaped `{ errors, values }`. Entries are the
   * raw values and raw failures, never a humanized message.
   */
  collectValues?: boolean;
};

/**
 * Captures failures and resolves nested Slang wrappers into one Result.
 * - Awaits the callback, then iteratively unwraps Result, Option, and Atom values.
 * - Returns the first Err or None as Err; cycles also return Err.
 * - Leaves object properties, array elements, and wrapped Promise values intact.
 * - `{ throw: true }` re-throws thrown errors; returned failures remain Err.
 * - `{ collectValues: true }` records every unwrapped layer and failure on
 *   `result.raw` as `{ errors, values }`.
 * - A caught throw reaches the caller as `Err(message)`, with the thrown value on `.raw`.
 *
 * @param fn - Function to execute (sync or async)
 * @param options - `{ throw?: boolean; collectValues?: boolean }`
 * @returns Promise of one Result containing the final success value or error text
 *
 * @example
 * const result = await safeTry(() => Ok(option("Hello")));
 * if (result.isOk) println(result.value); // "Hello"
 *
 * @example
 * const result = await safeTry(() => {
 *   throw new Error("Oops!");
 * });
 * if (result.isErr) println(result.error);
 */
export async function safeTry<T>(
  fn: () => T | Promise<T>,
  options?: SafeTryOptions,
  ..._noNestedResult: NestedValueGuard<Awaited<T>>
): Promise<Result<SafeTryValue<Awaited<T>>, string>> {
  const shouldThrow = options?.throw ?? false;
  const collectValues = options?.collectValues ?? false;
  const values: unknown[] = [];
  const errors: unknown[] = [];

  /** Attaches the collected layers when requested, then returns the result. */
  const finish = (
    result: Result<SafeTryValue<Awaited<T>>, string>,
  ): Result<SafeTryValue<Awaited<T>>, string> =>
    collectValues ? attachRaw(result, { errors, values }) : result;

  try {
    const rawResult = await fn();
    let evaluated = evaluateValue(rawResult);
    const visited = new Set<object>();
    let resultsSeen = isResult(rawResult) ? 1 : 0;
    // The raw cause of the outermost Result, when the callback itself failed.
    let rawFailure = isResult(rawResult) ? (rawResult as { raw?: unknown }).raw : undefined;
    let failing: unknown = evaluated.ok ? undefined : rawResult;

    while (evaluated.ok) {
      const value = evaluated.value;

      if (isResult(value)) {
        resultsSeen += 1;
        if (resultsSeen > 1) {
          // A Result inside a Result is forbidden; panic on the untyped case at runtime.
          panicNestedResult();
        }
      }

      if (collectValues) values.push(value);

      if (!isAtom(value) && !isResult(value) && !isOption(value)) {
        return finish(buildOk(value as SafeTryValue<Awaited<T>>));
      }

      if (value !== null && typeof value === "object") {
        if (visited.has(value)) {
          return finish(Err("Cannot resolve a circular value"));
        }
        visited.add(value);
      }

      evaluated = evaluateValue(value);
      if (!evaluated.ok) failing = value;
    }

    if (collectValues) {
      errors.push(isResult(failing) ? (failing as { error: unknown }).error : evaluated.error);
      return finish(Err(evaluated.error));
    }
    return Err(evaluated.error, rawFailure);
  } catch (error) {
    if (isNestedResultPanic(error)) throw error;

    const errorMessage = describeThrown(error);

    if (shouldThrow) {
      throw error instanceof Error ? error : new Error(errorMessage);
    }

    if (collectValues) {
      errors.push(error);
      return finish(Err(errorMessage));
    }

    return Err(errorMessage, error);
  }
}
