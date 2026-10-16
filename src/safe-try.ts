import { Ok, Err } from "./result";
import type { Result, Ok as OkType, Err as ErrType } from "./result";
import type { Some, None } from "./option";
import type { Atom } from "./atom";
import { evaluateValue, isAtom, isResult, isOption } from "./internals";

/** Terminal success value after resolving supported Slang wrappers. */
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
};

/**
 * Captures failures and resolves nested Slang wrappers into one Result.
 * - Awaits the callback, then iteratively unwraps Result, Option, and Atom values.
 * - Returns the first Err or None as Err; cycles also return Err.
 * - Leaves object properties, array elements, and wrapped Promise values intact.
 * - `{ throw: true }` re-throws thrown errors; returned failures remain Err.
 *
 * @param fn - Function to execute (sync or async)
 * @param options - `{ throw?: boolean }`
 * @returns Promise of one Result containing the terminal success value or error text
 *
 * @example
 * const result = await safeTry(() => Ok(Ok("Hello")));
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
): Promise<Result<SafeTryValue<Awaited<T>>, string>> {
  const shouldThrow = options?.throw ?? false;

  try {
    const rawResult = await fn();
    let evaluated = evaluateValue(rawResult);
    const visited = new Set<object>();

    while (evaluated.ok) {
      const value = evaluated.value;
      if (!isAtom(value) && !isResult(value) && !isOption(value)) {
        return Ok(value as SafeTryValue<Awaited<T>>);
      }

      if (value !== null && typeof value === "object") {
        if (visited.has(value)) {
          return Err("Cannot resolve a circular value");
        }
        visited.add(value);
      }

      evaluated = evaluateValue(value);
    }

    return Err(evaluated.error);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (shouldThrow) {
      throw error instanceof Error ? error : new Error(errorMessage);
    }

    return Err(errorMessage);
  }
}
