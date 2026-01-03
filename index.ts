/**
 * Logs the provided arguments to the console.
 * - Uses `globalThis.console.log` if available.
 * - Supports variadic arguments.
 * @param args - The arguments to log. Can be of any type.
 */
export const println = (...args: unknown[]): void => {
  (globalThis as any)?.console?.log?.(...args);
};

/** Schedules a microtask; falls back to Promise if unavailable */
const scheduleMicrotask = (fn: () => void) => {
  const qmt = (globalThis as any)?.queueMicrotask as (
    cb: () => void,
  ) => void | undefined;
  if (typeof qmt === "function") qmt(fn);
  else Promise.resolve().then(fn);
};

/**
 * Converts between Slang types.
 * - `option`: Wraps primitive or symbol description into `Option`
 * - `atom`: Converts `Some<string>` to `Atom` or returns symbol Atom
 * - `result`: Wraps values into `Ok`, `None` into `Err`
 */
export function _to<T>(value: Option<T>, target: "option"): Option<T>;
export function _to<T extends string>(
  value: Option<T>,
  target: "atom",
): Atom<T>;
export function _to<T extends string>(
  value: Atom<T>,
  target: "option",
): Option<string>;
export function _to<T extends string>(value: Atom<T>, target: "atom"): Atom<T>;
export function _to<T, E = string>(
  value: Option<T>,
  target: "result",
): Result<T, E>;
export function _to<E = string>(
  value: Atom<any>,
  target: "result",
): Result<string, E>;

export function _to(value: any, target: "option" | "atom" | "result"): any {
  const isOption = (v: any): v is Option<any> =>
    v != null && typeof v === "object" && "isSome" in v && "isNone" in v;

  if (value && (value.type === "Ok" || value.type === "Err")) {
    throw new Error("Cannot convert a Result to any other type");
  }

  switch (target) {
    case "option": {
      if (isOption(value)) return value;
      if (typeof value === "symbol") return option(value.description);
      return option(value);
    }

    case "atom": {
      if (isOption(value)) {
        if (value.isNone) throw new Error("Cannot convert None to Atom");
        if (typeof (value as Some<any>).value !== "string") {
          throw new Error("Only string values can be converted to Atom");
        }
        return atom((value as Some<string>).value);
      }
      if (typeof value === "symbol") return value;
      throw new Error(`Cannot convert type ${typeof value} to Atom`);
    }

    case "result": {
      if (isOption(value)) {
        return value.isSome ? Ok(value.value) : Err("Value is None");
      }
      if (typeof value === "symbol") return Ok(value.description);
      return Ok(value);
    }

    default:
      throw new Error(`Invalid target: ${target}`);
  }
}

/** Unique symbol to brand atoms */
declare const __atom__: unique symbol;

/** Atom type carrying the original name for hover/type info */
export type Atom<T extends string = string> = symbol & {
  readonly [__atom__]: T;
};

/**
 * Creates a new, unique atom (non-interned)
 * @param name Name of the atom (used for hover/description)
 * @example
 * const a = atom("loading");
 * typeof a; // Atom<"loading">
 */
/**
 * Creates a new, unique atom (non-interned)
 * @param name Name of the atom (used for hover/description)
 * @returns `Atom<T>` with chainable `to()`
 * @example
 * const ready = atom("ready");
 * ready.to("option"); // Some("ready")
 * ready.to("result"); // Ok("ready")
 */
/** Methods available on an Atom */
export interface AtomMethods<T extends string> {
  /** Returns the same atom */
  to(target: "atom"): Atom<T>;
  /** Returns `Option<string>` using the atom description
   * @example atom("ready").to("option") // Some("ready")
   */
  to(target: "option"): Option<string>;
  /** Returns `Ok<string>` using the atom description
   * @example atom("ready").to("result") // Ok("ready")
   */
  to(target: "result"): Result<string, string>;
}

/**
 * Creates a new, unique atom (non-interned).
 * - Atoms are symbols with additional methods for type-safe conversions.
 * @param name - Name of the atom (used for hover/description).
 * @returns `Atom<T>` with chainable `to()` method for conversions.
 * @example
 * const ready = atom("ready");
 * ready.to("option"); // Some("ready")
 * ready.to("result"); // Ok("ready")
 */
export function atom<const T extends string>(name: T) {
  const s = Symbol(name);
  const boxed = Object(s) as any;
  const to: AtomMethods<T>["to"] = ((target: "atom" | "option" | "result") =>
    (_to as any)(s, target)) as any;
  boxed.to = to;
  return boxed as Atom<T> & AtomMethods<T>;
}

// branding symbol
declare const __result__: unique symbol;

// Ok and Err types
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

// discriminated union: mutually exclusive
export type Result<T, E> = (Ok<T> | Err<E>) & ResultMethods<T>;

/**
 * Creates a new, successful result
 * @param value Value of the result
 * @example
 * const a = Ok("hello");
 * typeof a; // Ok<"hello">
 */
/** Methods available on a Result */
export interface ResultMethods<T> {
  /** Unwraps the value, throwing for Err
   * @example maybeFail().expect("must succeed")
   */
  expect(msg?: string): T;
  /** Returns an unwrap chain that throws if no else is provided
   * Use `.else(valueOrFn)` to supply a fallback for Err.
   * - If `Ok`, `.else(...)` returns the inner value and ignores fallback.
   * - If `Err`, `.else(...)` returns the fallback; if a function, it receives the error.
   */
  unwrap(): {
    /** Fallback value or function to recover from Err
     * If a function is provided, it is called with the Err's error.
     * Returns the unwrapped value (Ok) or the provided fallback (Err).
     */ else(fallback: T | ((error: any) => T)): T;
  };
}

/** Creates a new, successful result */
export function Ok<T>(value: T): Ok<T> & ResultMethods<T> {
  const ok = Object.freeze({
    type: "Ok",
    value,
    isOk: true,
    isErr: false,
  } as Ok<T>);
  const withMethods = {
    ...(ok as Ok<T>),
    /** Unwraps the value (always succeeds for Ok) */
    expect: ((msg?: string) => (ok as Ok<T>).value) as (msg?: string) => T,
    /** Returns chain; else ignored because Ok */
    unwrap: (() => {
      let handled = false;
      scheduleMicrotask(() => {
        // Ok never throws; microtask exists for symmetry
        handled;
      });
      return {
        else(fallback: T | (() => T)) {
          handled = true;
          return (ok as Ok<T>).value;
        },
      };
    }) as () => { else(fallback: T | (() => T)): T },
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
  const withMethods = {
    ...(err as Err<string>),
    /**
     * Throws with the provided message or the error string.
     * @example
     * maybeFail().expect("must succeed"); // throws if Err
     */
    expect: ((msg?: string) => {
      throw new Error(msg ?? error);
    }) as (msg?: string) => never,
    /** Chainable unwrap with microtask throw if not handled */
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
  };
  return withMethods as Err<string> & ResultMethods<never>;
}

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

export type NonTruthy = null | undefined | "";

const isFalsy = (value: any) => {
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
 * Creates a new truthy option
 * @param value - the value of the option
 * @example
 * const a = Some("hello");
 * typeof a; // Some<"hello">
 */
function Some<T>(value: T): Some<T> {
  if (isFalsy(value))
    throw new Error(
      "Cannot wrap null, undefined, NaN, or empty string in Some",
    );
  return Object.freeze({
    type: "Some",
    value,
    isSome: true,
    isNone: false,
  } as Some<T>);
}

const None: None = Object.freeze({
  type: "None",
  isSome: false,
  isNone: true,
} as None);

/**
 * Creates a new option type from a value
 * @param value - the value to be made an option
 * @tutorial The returned option will be Some if the value is truthy, and None if it is not (null,undefined,Nan,'')
 * @example
 * const b = option("hello");
 * typeof b; // Some<"hello">
 * const c = option(null);
 * typeof c; // None
 * const d = option(undefined);
 * typeof d; // None
 * const e = option(0);
 * typeof e; // Some<number>
 * const f = option("");
 * typeof f; // None
 * const g = option(false);
 * typeof g; // Some<boolean>
 */
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
  /** Returns an unwrap chain that MUST be completed with `.else(...)`.
   * If `.else(...)` is not chained, an error is thrown ("Expected else").
   * - If `Some`, `.else(...)` is required but ignored for outcome; returns the inner value.
   * - If `None`, `.else(...)` provides fallback; if a function, it is called with `undefined`.
   * - Fallback result must be truthy; otherwise, throws ("Fallback must be truthy").
   */
  unwrap(): {
    /** Fallback value or transformer to recover from `None`.
     * - Function form receives `undefined` and must return a truthy value.
     * - Direct value must be truthy.
     * Returns the inner value for `Some`, or the validated fallback for `None`.
     */ else(fallback: T | ((value: T | undefined) => T)): T;
  };
}

/**
 * Creates a new option type from a value.
 * - Truthy values become `Some<T>`; `null|undefined|""` become `None`.
 * - Provides chainable `.to()` and `.expect()` helpers.
 * @example
 * option("hi").expect(); // "hi"
 * option("").expect("cannot be empty"); // throws Error("cannot be empty")
 * option("state").to("atom"); // Atom<"state">
 * option(null).to("result"); // Err("Value is None")
 */
export function option<T>(value: T | NonTruthy) {
  const opt = isFalsy(value) ? None : Some(value as T);
  const to: OptionMethods<T>["to"] = ((target: "atom" | "option" | "result") =>
    (_to as any)(opt, target)) as any;
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
        // If Some, ignore else and return inner value
        if (currentOption.isSome) return (currentOption as Some<T>).value;

        // None path: compute fallback result
        const result =
          typeof fallback === "function"
            ? (fallback as (value: T | undefined) => T)(undefined)
            : (fallback as T);

        // Ensure fallback result is truthy using option()
        const check = option(result as T);
        if (check.isNone) {
          throw new Error("Fallback must be truthy");
        }
        return result as T;
      },
    };
  }) as any;
  const withMethods = {
    ...(opt as Option<T>),
    to,
    expect,
    unwrap,
  };
  return withMethods as Option<T> & OptionMethods<T>;
}

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
type MatchPatterns<V, R> = {
  [K in MatchKey]?: (v: V) => R;
} & { _: () => R };

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
export function matchAll<T extends MatchKey | boolean, R>(
  value: T,
  patterns: MatchPatterns<T, R>,
): R {
  // For Atom, we use description for semantic matching
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

  return patterns._();
}

/**
 * Converts an input to array of values.
 * - Extracts values from arrays, Sets, or objects based on `includeValues` flag.
 * - Guards against type mismatches when `includeValues` is false.
 * @param input Array, Set, or Object to convert
 * @param includeValues If false (default), only arrays allowed; if true, also extracts values from Sets/Objects
 * @returns Array of values extracted from input
 */
function toArray<T>(
  input: Iterable<T> | { [key: string]: T },
  includeValues = false,
): T[] {
  if (!includeValues && !Array.isArray(input)) {
    throw new Error("Only arrays allowed when includeValues=false");
  }
  if (Array.isArray(input)) return input;
  if (input instanceof Set) return Array.from(input);
  return Object.values(input);
}

/**
 * Combines multiple collections element-wise into tuples.
 * - All inputs must be the same type (all arrays, all Sets, or all objects).
 * - By default, only arrays are allowed; set `includeValues: true` to extract values from Sets/Objects.
 * - Stops at shortest collection by default; use `fillValue` to extend to longest.
 * - Transforms columns into rows for parallel iteration.
 * @param inputs Collections of the same type to combine
 * @param options Configuration: `fillValue` extends to longest, `includeValues` extracts values from Sets/Objects (default: false)
 * @returns Array of tuples, one per index position
 * @example
 * zip([[1, 2], ['a', 'b']]); // [[1, 'a'], [2, 'b']]
 * zip([[1, 2], ['a']], { fillValue: 'x' }); // [[1, 'a'], [2, 'x']]
 * const s1 = new Set([1, 2]); const s2 = new Set([3, 4]);
 * zip([s1, s2], { includeValues: true }); // [[1, 3], [2, 4]]
 */
export function zip<T extends readonly any[]>(
  inputs: { [K in keyof T]: Iterable<T[K]> | { [key: string]: T[K] } },
  options?: { fillValue?: T[number]; includeValues?: boolean },
): T[number][][] {
  const { fillValue, includeValues = false } = options || {};
  if (inputs.length === 0) return [];

  const arrays = inputs.map((inp) => toArray(inp, includeValues));
  const maxLength = Math.max(...arrays.map((a) => a.length));
  const minLength = Math.min(...arrays.map((a) => a.length));
  const length = fillValue === undefined ? minLength : maxLength;

  const result: T[number][][] = [];
  for (let i = 0; i < length; i++) {
    result.push(
      arrays.map((a) => (i < a.length ? a[i] : fillValue!)) as T[number][],
    );
  }
  return result;
}

/**
 * Combines multiple collections element-wise and transforms each tuple.
 * - All inputs must be the same type (all arrays, all Sets, or all objects).
 * - By default, only arrays are allowed; set `includeValues: true` to extract values from Sets/Objects.
 * - Applies a function to each set of corresponding elements.
 * - Useful for aggregating, computing, or transforming aligned data.
 * @param inputs Collections of the same type to combine
 * @param fn Transform function applied to each tuple
 * @param options Configuration: `fillValue` extends to longest, `includeValues` extracts values from Sets/Objects (default: false)
 * @returns Array of transformed results
 * @example
 * zipWith([[1, 2], [3, 4]], (t) => t[0] + t[1]); // [4, 6]
 * zipWith([[1, 2], [10]], (t) => t.reduce((a, b) => a + b, 0), { fillValue: 0 }); // [11, 2]
 */
export function zipWith<T extends readonly any[], R>(
  inputs: { [K in keyof T]: Iterable<T[K]> | { [key: string]: T[K] } },
  fn: (tuple: T[number][]) => R,
  options?: { fillValue?: T[number]; includeValues?: boolean },
): R[] {
  return zip(inputs, options).map(fn);
}

/**
 * Unzips an array of tuples back into separate arrays.
 * - Reverses the zip operation: transforms rows to columns.
 * - Useful for separating previously combined collections.
 * @param zipped Array of tuples (rows) to transpose
 * @returns Array of arrays (columns), one per tuple position
 * @example
 * const zipped = [[1, 'a'], [2, 'b'], [3, 'c']];
 * unzip(zipped); // [[1, 2, 3], ['a', 'b', 'c']]
 */
export function unzip<T>(zipped: T[][]): T[][] {
  if (zipped.length === 0) return [];
  const length = zipped[0]?.length ?? 0;
  const result: T[][] = Array.from({ length }, () => []);
  for (const tuple of zipped) {
    tuple.forEach((v, i) => result[i]?.push(v));
  }
  return result;
}

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

/**
 * Options for safeTry behavior.
 */
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

/**
 * Throws an error immediately.
 * @param message - Error message
 * @example
 * panic("Critical!");
 */
export function panic(message: string): never {
  throw new Error(message);
}
