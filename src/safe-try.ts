import { Ok, Err } from "./result";
import type { Result } from "./result";
import { evaluateValue } from "./internals";

/** Options for safeTry behavior */
type SafeTryOptions = {
  /** If true, re-throws the error instead of capturing it */
  throw?: boolean;
};

/**
 * Wraps a function in try-catch, returns `Result<T, string>`.
 * - Always returns a Promise resolving to Ok or Err.
 * - Internally evaluates return values from Atom, Result, or Option types.
 * - Use `{ throw: true }` to re-throw errors instead of capturing.
 *
 * @param fn - Function to execute (sync or async)
 * @param options - `{ throw?: boolean }`
 * @returns Promise of `Result<T, string>`
 *
 * @example
 * const result = await safeTry(() => "Hello");
 * if (result.isOk) println(result.value);
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
): Promise<Result<T, string>> {
  const shouldThrow = options?.throw ?? false;

  try {
    const rawResult = await fn();
    const evaluated = evaluateValue(rawResult);

    if (evaluated.ok) {
      return Ok(evaluated.value as T);
    }
    return Err((evaluated as { ok: false; error: string }).error);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (shouldThrow) {
      throw error instanceof Error ? error : new Error(errorMessage);
    }

    return Err(errorMessage);
  }
}
