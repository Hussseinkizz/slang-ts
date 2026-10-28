import { scheduleMicrotask, describeThrown, isResult, panicNestedResult } from "./internals";
import { iterateOf } from "./iterate";
import type { IterateChain } from "./iterate";

declare const __result__: unique symbol;

export type Ok<T> = {
  type: "Ok";
  value: T;
  /** Optional description of the success, such as a message to show the user. */
  readonly message?: string;
  /** Non-enumerable diagnostic payload, set by a collected or raw result. */
  readonly raw?: unknown;
  readonly isOk: true;
  readonly isErr: false;
  readonly [__result__]: true;
  /**
   * Lazily transforms the successful collection. Only a successful Result exposes this;
   * a possible `Err` must be narrowed with `.isOk` first.
   */
  iterate(): IterateChain<T>;
};

export type Err<E> = {
  type: "Err";
  error: E;
  /** Non-enumerable diagnostic payload for the underlying cause. */
  readonly raw?: unknown;
  readonly isOk: false;
  readonly isErr: true;
  readonly [__result__]: true;
};

/** Discriminated union: mutually exclusive Ok or Err */
export type Result<T, E> = (Ok<T> | Err<E>) & ResultMethods<T>;

/**
 * Rest-parameter guard: a required element only when `T` is a Result, so wrapping a
 * Result in another Result fails to compile while ordinary calls keep their inference.
 */
export type NestedResultGuard<T> = [T] extends [never]
  ? []
  : T extends { readonly [__result__]: true }
    ? ["A Result cannot be nested inside another Result"]
    : [];

/**
 * Rest-parameter guard for `safeTry`: a required element when the returned value is a
 * Result whose own value is a Result. A Result may be returned; a Result inside it may not.
 */
export type NestedValueGuard<T> = [T] extends [never]
  ? []
  : T extends Result<infer Value, infer _Error>
    ? [Value] extends [never]
      ? []
      : Value extends { readonly [__result__]: true }
        ? ["A Result's value cannot be another Result"]
        : []
    : [];

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
   * - If fn returns a Result, it is returned as is; it is never wrapped again.
   * - If fn returns `undefined`, returns original Result (no new allocation).
   * - If fn throws, returns `Err(message)`.
   * - Supports async functions, returning `Promise<Result<U, string>>`.
   * @example
   * Ok(5).andThen(x => x * 2);             // Ok(10)
   * Ok(5).andThen(x => Ok(x * 2));         // Ok(10) - a returned Result is flattened
   * Err("fail").andThen(x => x * 2);       // Err("fail")
   * Ok(5).andThen(x => undefined);         // Ok(5) - original
   * await Ok(5).andThen(async x => x);     // Ok(5)
   */
  andThen<U>(
    fn: (value: T) => U | Result<U, string> | Promise<U | Result<U, string>>
  ): Result<U, string> | Promise<Result<U, string>>;
}

/**
 * @internal Builds an Ok without the compile-time nesting guard, for a value already
 * known to be plain. Refuses a Result at runtime, so no builder can nest one.
 */
export function buildOk<T>(value: T, message?: string): Ok<T> & ResultMethods<T> {
  if (isResult(value)) panicNestedResult();
  const ok = Object.freeze({
    type: "Ok",
    value,
    ...(message === undefined ? {} : { message }),
    isOk: true,
    isErr: false,
  } as Ok<T>);

  const andThen = <U>(
    fn: (value: T) => U | Result<U, string> | Promise<U | Result<U, string>>,
  ): Result<U, string> | Promise<Result<U, string>> => {
    // A returned Result is passed through, never wrapped again.
    const settle = (value: U | Result<U, string> | undefined): Result<U, string> => {
      if (value === undefined) return withMethods as unknown as Result<U, string>;
      if (isResult(value)) {
        if (isResult((value as { value?: unknown }).value)) panicNestedResult();
        return value as Result<U, string>;
      }
      return buildOk(value) as Result<U, string>;
    };

    try {
      const result = fn((ok as Ok<T>).value);

      if (result instanceof Promise) {
        return result
          .then((resolved) => settle(resolved as U | Result<U, string>))
          .catch((error) => Err(describeThrown(error)) as Result<U, string>);
      }

      return settle(result as U | Result<U, string>);
    } catch (error) {
      return Err(describeThrown(error)) as Result<U, string>;
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
    iterate: () => iterateOf<T>((ok as Ok<T>).value),
  };

  return withMethods as Ok<T> & ResultMethods<T>;
}

/**
 * Creates a new, successful result.
 * @param value Value of the result. A Result is rejected; a Result never nests inside another Result.
 * @param message Optional description of the success; omitted values leave no `message` property
 * @example
 * const a = Ok("hello");
 * typeof a; // Ok<"hello">
 * const b = Ok({ id: 1 }, "Project created");
 * b.message; // "Project created"
 */
export function Ok<T>(
  value: T,
  message?: string,
  ..._noNestedResult: NestedResultGuard<T>
): Ok<T> & ResultMethods<T> {
  return buildOk(value, message);
}

/**
 * Creates a new, failed result with a string error message.
 * @param error Error message (must be a string)
 * @param raw Optional underlying cause, kept as given and non-enumerable on `.raw`
 * @example
 * const a = Err("something went wrong");
 * typeof a; // Err<string>
 */
export function Err(error: string, raw?: unknown): Err<string> & ResultMethods<never> {
  const err = Object.freeze({
    type: "Err",
    error,
    isOk: false,
    isErr: true,
  } as Err<string>);

  // Err.andThen skips fn, returns same instance
  const andThen = <U>(
    _fn: (value: never) => U | Result<U, string> | Promise<U | Result<U, string>>,
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

  return attachRaw(withMethods, raw) as Err<string> & ResultMethods<never>;
}

/**
 * Attaches a non-enumerable diagnostic payload to a Result.
 * The payload never appears in `JSON.stringify`, spread, or `Object.keys`, so a raw
 * cause can travel beside a safe message without reaching the wire.
 * @internal
 */
export function attachRaw<R extends object>(result: R, raw: unknown): R {
  if (raw === undefined) return result;
  Object.defineProperty(result, "raw", {
    value: raw,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return result;
}
