import { scheduleMicrotask } from "./internals";

declare const __result__: unique symbol;

export type Ok<T> = {
  type: "Ok";
  value: T;
  readonly isOk: true;
  readonly isErr: false;
  readonly [__result__]: true;
};

export type Err<E> = {
  type: "Err";
  error: E;
  readonly isOk: false;
  readonly isErr: true;
  readonly [__result__]: true;
};

/** Discriminated union: mutually exclusive Ok or Err */
export type Result<T, E> = (Ok<T> | Err<E>) & ResultMethods<T>;

/** Methods available on a Result */
export interface ResultMethods<T> {
  /**
   * Unwraps the value, throwing for Err.
   * @example maybeFail().expect("must succeed")
   */
  expect(msg?: string): T;
  /**
   * Returns an unwrap chain that throws if no else is provided.
   * Use `.else(valueOrFn)` to supply a fallback for Err.
   * - If `Ok`, `.else(...)` returns the inner value and ignores fallback.
   * - If `Err`, `.else(...)` returns the fallback; if a function, it receives the error.
   */
  unwrap(): {
    /**
     * Fallback value or function to recover from Err.
     * If a function is provided, it is called with the Err's error.
     * Returns the unwrapped value (Ok) or the provided fallback (Err).
     */
    else(fallback: T | ((error: any) => T)): T;
  };
  /**
   * Transforms the inner value if `Ok`, returns same `Err` if `Err`.
   * - If fn returns `undefined`, returns original Result (no new allocation).
   * - If fn throws, returns `Err(message)`.
   * - Supports async functions, returning `Promise<Result<U, string>>`.
   * @example
   * Ok(5).andThen(x => x * 2);             // Ok(10)
   * Err("fail").andThen(x => x * 2);       // Err("fail")
   * Ok(5).andThen(x => undefined);         // Ok(5) - original
   * await Ok(5).andThen(async x => x);     // Ok(5)
   */
  andThen<U>(fn: (value: T) => U | Promise<U>): Result<U, string> | Promise<Result<U, string>>;
}

/**
 * Creates a new, successful result.
 * @param value Value of the result
 * @example
 * const a = Ok("hello");
 * typeof a; // Ok<"hello">
 */
export function Ok<T>(value: T): Ok<T> & ResultMethods<T> {
  const ok = Object.freeze({
    type: "Ok",
    value,
    isOk: true,
    isErr: false,
  } as Ok<T>);

  const andThen = <U>(
    fn: (value: T) => U | Promise<U>,
  ): Result<U, string> | Promise<Result<U, string>> => {
    try {
      const result = fn((ok as Ok<T>).value);

      // Handle async
      if (result instanceof Promise) {
        return result
          .then((resolved) => {
            if (resolved === undefined) return withMethods as unknown as Result<U, string>;
            return Ok(resolved) as Result<U, string>;
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            return Err(message) as Result<U, string>;
          });
      }

      // Sync: undefined means return original
      if (result === undefined) return withMethods as unknown as Result<U, string>;
      return Ok(result) as Result<U, string>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Err(message) as Result<U, string>;
    }
  };

  const withMethods = {
    ...(ok as Ok<T>),
    expect: ((msg?: string) => (ok as Ok<T>).value) as (msg?: string) => T,
    unwrap: (() => {
      let handled = false;
      scheduleMicrotask(() => {
        handled;
      });
      return {
        else(fallback: T | (() => T)) {
          handled = true;
          return (ok as Ok<T>).value;
        },
      };
    }) as () => { else(fallback: T | (() => T)): T },
    andThen,
  };

  return withMethods as Ok<T> & ResultMethods<T>;
}

/**
 * Creates a new, failed result with a string error message.
 * @param error Error message (must be a string)
 * @example
 * const a = Err("something went wrong");
 * typeof a; // Err<string>
 */
export function Err(error: string): Err<string> & ResultMethods<never> {
  const err = Object.freeze({
    type: "Err",
    error,
    isOk: false,
    isErr: true,
  } as Err<string>);

  // Err.andThen skips fn, returns same instance
  const andThen = <U>(
    _fn: (value: never) => U | Promise<U>,
  ): Result<U, string> | Promise<Result<U, string>> => {
    return withMethods as unknown as Result<U, string>;
  };

  const withMethods = {
    ...(err as Err<string>),
    expect: ((msg?: string) => {
      throw new Error(msg ?? error);
    }) as (msg?: string) => never,
    unwrap: (() => {
      let handled = false;
      scheduleMicrotask(() => {
        if (!handled) {
          throw new Error(error);
        }
      });
      return {
        else<T>(fallback: T | ((error: string) => T)): T {
          handled = true;
          if (typeof fallback === "function") {
            return (fallback as (error: string) => T)(error);
          }
          return fallback as T;
        },
      };
    }) as () => { else<T>(fallback: T | ((error: string) => T)): T },
    andThen,
  };

  return withMethods as Err<string> & ResultMethods<never>;
}
