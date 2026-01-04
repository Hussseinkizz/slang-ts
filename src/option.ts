import { scheduleMicrotask } from "./internals";
import type { Atom } from "./atom";
import type { Result } from "./result";

declare const __option__: unique symbol;

export type Some<T> = {
  type: "Some";
  value: T;
  readonly isSome: true;
  readonly isNone: false;
  readonly [__option__]: true;
};

export type None = {
  type: "None";
  readonly isSome: false;
  readonly isNone: true;
  readonly [__option__]: true;
};

export type Option<T> = (Some<T> | None) & OptionMethods<T>;

/** Values treated as falsy by Option */
export type NonTruthy = null | undefined | "";

/** Methods available on an Option */
export interface OptionMethods<T> {
  /** Returns the same option */
  to(target: "option"): Option<T>;
  /** Converts `Some<string>` to `Atom<string>`; throws for `None` or non-string */
  to(target: "atom"): Atom<T & string>;
  /** Converts to `Result<T, string>`; `None` becomes `Err("Value is None")` */
  to(
    target: "result",
  ): Result<T | (T extends string ? never : Atom<string>), string>;
  /**
   * Unwraps the option, throwing if `None`.
   * @throws Error with provided message or default.
   * @example
   * option(42).expect(); // 42
   * option("").expect("must be present"); // throws
   */
  expect(msg?: string): T;
  /**
   * Returns an unwrap chain that MUST be completed with `.else(...)`.
   * If `.else(...)` is not chained, an error is thrown ("Expected else").
   * - If `Some`, `.else(...)` is required but ignored for outcome; returns the inner value.
   * - If `None`, `.else(...)` provides fallback; if a function, it is called with `undefined`.
   * - Fallback result must be truthy; otherwise, throws ("Fallback must be truthy").
   */
  unwrap(): {
    /**
     * Fallback value or transformer to recover from `None`.
     * - Function form receives `undefined` and must return a truthy value.
     * - Direct value must be truthy.
     * Returns the inner value for `Some`, or the validated fallback for `None`.
     */
    else(fallback: T | ((value: T | undefined) => T)): T;
  };
  /**
   * Transforms the inner value if `Some`, returns `None` if `None`.
   * - If fn returns `undefined`, returns original Option (no new allocation).
   * - If fn throws, returns `None`.
   * - Supports async functions, returning `Promise<Option<U>>`.
   * @example
   * option(5).andThen(x => x * 2);           // Some(10)
   * option(null).andThen(x => x * 2);        // None
   * option(5).andThen(x => undefined);       // Some(5) - original
   * await option(5).andThen(async x => x);   // Some(5)
   */
  andThen<U>(fn: (value: T) => U | Promise<U>): Option<U> | Promise<Option<U>>;
}

/**
 * Checks if a value is falsy for Option purposes.
 * Falsy: null, undefined, empty string, NaN, Infinity, -Infinity
 */
export const isFalsy = (value: any): boolean => {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    Number.isNaN(value) ||
    value === Infinity ||
    value === -Infinity
  );
};

/**
 * Creates a new truthy option.
 * @param value - the value of the option
 * @throws Error if value is falsy
 * @example
 * const a = Some("hello");
 * typeof a; // Some<"hello">
 */
function Some<T>(value: T): Some<T> {
  if (isFalsy(value)) {
    throw new Error(
      "Cannot wrap null, undefined, NaN, or empty string in Some",
    );
  }
  return Object.freeze({
    type: "Some",
    value,
    isSome: true,
    isNone: false,
  } as Some<T>);
}

/** Singleton None value */
const None: None = Object.freeze({
  type: "None",
  isSome: false,
  isNone: true,
} as None);

/** Lazy import to avoid circular dependency */
let _toFn: ((value: any, target: string) => any) | null = null;

/**
 * Sets the _to converter function (called from to.ts to break circular dep).
 * @internal
 */
export function setToConverter(fn: (value: any, target: string) => any) {
  _toFn = fn;
}

/**
 * Creates a new option type from a value.
 * - Truthy values become `Some<T>`; `null|undefined|""` become `None`.
 * - Provides chainable `.to()`, `.expect()`, and `.unwrap()` helpers.
 * @example
 * option("hi").expect(); // "hi"
 * option("").expect("cannot be empty"); // throws Error("cannot be empty")
 * option("state").to("atom"); // Atom<"state">
 * option(null).to("result"); // Err("Value is None")
 */
export function option<T>(value: T | NonTruthy): Option<T> & OptionMethods<T> {
  const opt = isFalsy(value) ? None : Some(value as T);

  const to: OptionMethods<T>["to"] = ((target: "atom" | "option" | "result") => {
    if (!_toFn) throw new Error("Converter not initialized");
    return _toFn(opt, target);
  }) as any;

  const expect: OptionMethods<T>["expect"] = ((msg?: string) => {
    if ((opt as Option<T>).isSome) return (opt as Some<T>).value;
    throw new Error(msg ?? "Expected Some, got None");
  }) as any;

  const unwrap: OptionMethods<T>["unwrap"] = (() => {
    let handled = false;
    const currentOption = opt as Option<T>;

    scheduleMicrotask(() => {
      if (!handled) {
        throw new Error("Expected else");
      }
    });

    return {
      else(fallback: T | ((value: T | undefined) => T)) {
        handled = true;
        if (currentOption.isSome) return (currentOption as Some<T>).value;

        const result =
          typeof fallback === "function"
            ? (fallback as (value: T | undefined) => T)(undefined)
            : (fallback as T);

        // Validate fallback is truthy
        if (isFalsy(result)) {
          throw new Error("Fallback must be truthy");
        }
        return result as T;
      },
    };
  }) as any;

  const andThen: OptionMethods<T>["andThen"] = (<U>(
    fn: (value: T) => U | Promise<U>,
  ): Option<U> | Promise<Option<U>> => {
    const currentOption = opt as Option<T>;

    // None case: skip fn, return same instance
    if (currentOption.isNone) {
      return withMethods as unknown as Option<U>;
    }

    const currentValue = (currentOption as Some<T>).value;

    try {
      const result = fn(currentValue);

      // Handle async
      if (result instanceof Promise) {
        return result
          .then((resolved) => {
            if (resolved === undefined) return withMethods as unknown as Option<U>;
            return option(resolved) as Option<U>;
          })
          .catch(() => option(null as NonTruthy) as Option<U>);
      }

      // Sync: undefined means return original
      if (result === undefined) return withMethods as unknown as Option<U>;
      return option(result) as Option<U>;
    } catch {
      return option(null as NonTruthy) as Option<U>;
    }
  }) as any;

  const withMethods = {
    ...(opt as Option<T>),
    to,
    expect,
    unwrap,
    andThen,
  };

  return withMethods as Option<T> & OptionMethods<T>;
}

export { Some, None };
