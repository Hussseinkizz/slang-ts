import { Ok, Err } from "./result";
import type { Result } from "./result";
import type { Option } from "./option";

/** Type guard for Result */
const isResult = (value: unknown): value is Result<unknown, unknown> =>
  value != null &&
  typeof value === "object" &&
  "type" in value &&
  (value.type === "Ok" || value.type === "Err");

/** Type guard for Option */
const isOption = (value: unknown): value is Option<unknown> =>
  value != null &&
  typeof value === "object" &&
  "isSome" in value &&
  "isNone" in value;

/** Type guard for Atom (boxed symbol) */
const isAtom = (value: unknown): boolean =>
  value != null &&
  typeof value === "object" &&
  typeof (value as any).valueOf?.() === "symbol";

/**
 * Evaluates and extracts inner value from Slang types.
 * Internal utility used by safeTry.
 */
function evaluateValue<T>(value: T): { ok: true; value: unknown } | { ok: false; error: string } {
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
    return Err(evaluated.error);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (shouldThrow) {
      throw error instanceof Error ? error : new Error(errorMessage);
    }

    return Err(errorMessage);
  }
}
